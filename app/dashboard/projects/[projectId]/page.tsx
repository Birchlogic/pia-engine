"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
    Activity, 
    Check, 
    Loader2, 
    Play, 
    Users,
    FileText,
    Layout,
    ShieldAlert,
    Database,
    Layers,
    Plus
} from "lucide-react";
import { DfdHtmlRenderer } from "@/components/dfd/DfdHtmlRenderer";
import { formatError } from "@/lib/utils";

interface MasterDfdResults {
    project_id: string;
    status: string;
    project_name: string;
    session_ids: string[];
    overview_summary: {
        project_name: string;
        departments: string[];
        total_sessions: number;
        total_nodes: number;
        total_edges: number;
        total_risks: number;
        kg_total_risks?: number;
        total_data_elements: number;
        kg_total_data_elements?: number;
        node_types: Record<string, number>;
        risk_severity_breakdown: Record<string, number>;
        unique_data_elements_list: string[];
        sessions_aggregated: string[];
        ai_executive_summary: string;
    };
    dfd_json?: any;
    master_html?: string;
}

type Vertical = {
    id: string;
    name: string;
    description: string | null;
    headName: string | null;
    headRole: string | null;
    assessmentStatus: string;
    sessionRunLimit: number;
    _count: { sessions: number };
    sessions: { id: string; sessionNumber: number; sessionDate: string }[];
};

type ProjectDetail = {
    id: string;
    name: string;
    description: string | null;
    status: string;
    assessmentType: string;
    applicableRegulations: string[];
    organization: { id: string; name: string };
    verticals: Vertical[];
    _count: { verticals: number };
};

type ProjectMember = {
    id: string;
    userId: string;
    role: string;
    name: string;
    email: string;
    platformRole: string;
};

type AvailableUser = {
    id: string;
    name: string;
    email: string;
    role: string;
};

const statusConfig: Record<string, { label: string; color: string; percent: number }> = {
    not_started: { label: "Not Started", color: "bg-zinc-500", percent: 0 },
    in_progress: { label: "In Progress", color: "bg-yellow-500", percent: 25 },
    matrix_generated: { label: "Matrix Generated", color: "bg-blue-500", percent: 50 },
    matrix_approved: { label: "Matrix Approved", color: "bg-purple-500", percent: 75 },
    dfd_generated: { label: "DFD Generated", color: "bg-green-500", percent: 100 },
};

const defaultVerticals = [
    "Human Resources",
    "Finance & Accounting",
    "Engineering / Product",
    "Customer Care / Support",
    "Sales & Marketing",
    "Legal & Compliance",
    "IT / Infrastructure",
    "Administration / Facilities",
    "Third-Party / Vendor Management",
    "Executive / Leadership",
];

export default function ProjectPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const { projectId } = useParams<{ projectId: string }>();
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [addingDefaults, setAddingDefaults] = useState(false);
    const [form, setForm] = useState({ name: "", description: "", headName: "", headRole: "" });
    const [deleteVerticalId, setDeleteVerticalId] = useState<string | null>(null);
    const [deletingVertical, setDeletingVertical] = useState(false);
    const verticalToDelete = project?.verticals.find((v) => v.id === deleteVerticalId);

    // Members state
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [assignUserOpen, setAssignUserOpen] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [assignRole, setAssignRole] = useState<string>("analyst");
    
    // Remove Member state
    const [removeMemberObj, setRemoveMemberObj] = useState<ProjectMember | null>(null);
    const [removingMember, setRemovingMember] = useState(false);
    
    // Master DFD state
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
    const [masterDfdStatus, setMasterDfdStatus] = useState<any>(null);
    const [masterDfdResults, setMasterDfdResults] = useState<MasterDfdResults | null>(null);
    const [pollingMaster, setPollingMaster] = useState(false);
    const [generatingMaster, setGeneratingMaster] = useState(false);

    const fetchProject = async () => {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
            const data = await res.json();
            setProject(data.success ? data.data : data);
        }
        setLoading(false);
    };

    const fetchMembers = async () => {
        setMembersLoading(true);
        const res = await fetch(`/api/projects/${projectId}/members`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                setMembers(data.data.members);
                setAvailableUsers(data.data.availableUsers);
            }
        }
        setMembersLoading(false);
    };

    useEffect(() => {
        fetchProject();
        fetchMembers();
    }, [projectId]);

    const handleAssignMember = async () => {
        if (!selectedUser) {
            toast.error("Please select a user");
            return;
        }
        setAssigning(true);
        const res = await fetch(`/api/projects/${projectId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: selectedUser, role: assignRole }),
        });

        if (res.ok) {
            toast.success("Member assigned successfully");
            setAssignUserOpen(false);
            setSelectedUser("");
            setAssignRole("analyst");
            fetchMembers();
        } else {
            const data = await res.json();
            toast.error(formatError(data.message || data.error || "Failed to assign member"));
        }
        setAssigning(false);
    };

    const confirmRemoveMember = async () => {
        if (!removeMemberObj) return;
        setRemovingMember(true);
        const res = await fetch(`/api/projects/${projectId}/members?userId=${removeMemberObj.userId}`, {
            method: "DELETE",
        });
        if (res.ok) {
            toast.success("Member removed");
            fetchMembers();
        } else {
            const data = await res.json();
            toast.error(formatError(data.message || data.error || "Failed to remove member"));
        }
        setRemovingMember(false);
        setRemoveMemberObj(null);
    };

    const handleCreate = async () => {
        if (!form.name.trim()) {
            toast.error("Vertical name is required");
            return;
        }
        setCreating(true);
        const res = await fetch("/api/verticals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                projectId,
                name: form.name,
                description: form.description || null,
                headName: form.headName || null,
                headRole: form.headRole || null,
            }),
        });
        if (res.ok) {
            toast.success("Vertical added");
            setDialogOpen(false);
            setForm({ name: "", description: "", headName: "", headRole: "" });
            fetchProject();
        } else {
            toast.error("Failed to add vertical");
        }
        setCreating(false);
    };

    const handleDeleteVertical = (e: React.MouseEvent, verticalId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteVerticalId(verticalId);
    };

    const confirmDeleteVertical = async () => {
        if (!deleteVerticalId) return;
        const name = verticalToDelete?.name || "vertical";
        setDeletingVertical(true);
        const toastId = toast.loading(`Deleting ${name}...`);
        try {
            const res = await fetch(`/api/verticals/${deleteVerticalId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success(`${name} deleted successfully`, { id: toastId });
                setDeleteVerticalId(null);
                fetchProject();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete vertical", { id: toastId });
            }
        } catch {
            toast.error("Network error deleting vertical", { id: toastId });
        } finally {
            setDeletingVertical(false);
        }
    };

    const handleAddDefaults = async () => {
        setAddingDefaults(true);
        const existing = project?.verticals.map((v) => v.name.toLowerCase()) || [];
        const toAdd = defaultVerticals.filter(
            (v) => !existing.includes(v.toLowerCase())
        );

        for (const name of toAdd) {
            await fetch("/api/verticals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, name }),
            });
        }
        toast.success(`Added ${toAdd.length} default verticals`);
        fetchProject();
        setAddingDefaults(false);
    };

    const handleVerticalToggle = (verticalId: string) => {
        const newSelected = new Set(selectedSessions);
        if (newSelected.has(verticalId)) {
            newSelected.delete(verticalId);
        } else {
            newSelected.add(verticalId);
        }
        setSelectedSessions(newSelected);
    };

    const generateMasterDfd = async () => {
        if (selectedSessions.size < 2) {
            toast.error("Please select at least 2 sessions to generate a Master DFD");
            return;
        }

        setGeneratingMaster(true);
        const toastId = toast.loading("Initiating Master DFD generation...");
        
        try {
            const res = await fetch(`/api/projects/${projectId}/master-dfd/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedSessions),
                    projectName: project?.name
                })
            });

            if (res.ok) {
                toast.success("Generation started!", { id: toastId });
                setPollingMaster(true);
            } else {
                const data = await res.json();
                toast.error(formatError(data.error || data.message || "Failed to start generation"), { id: toastId });
                setGeneratingMaster(false);
            }
        } catch (err) {
            toast.error("Network error starting configuration", { id: toastId });
            setGeneratingMaster(false);
        }
    };

    const fetchMasterDfdResults = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/master-dfd`);
            if (res.ok) {
                const data = await res.json();
                setMasterDfdResults(data);
            }
        } catch (err) {
            console.error("Error fetching master results:", err);
        }
    };

    useEffect(() => {
        if (!pollingMaster) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/master-dfd/status`);
                if (res.ok) {
                    const data = await res.json();
                    setMasterDfdStatus(data);

                    if (data.status === "completed") {
                        clearInterval(interval);
                        setPollingMaster(false);
                        setGeneratingMaster(false);
                        toast.success("Master DFD generated successfully!");
                        fetchMasterDfdResults();
                    } else if (data.status === "failed") {
                        clearInterval(interval);
                        setPollingMaster(false);
                        setGeneratingMaster(false);
                        toast.error(formatError(data.error_message || data.error || "Master DFD generation failed"));
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [pollingMaster, projectId]);

    useEffect(() => {
        // Initial check for master DFD results
        fetchMasterDfdResults();
    }, [projectId]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Project not found</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/projects" className="hover:text-foreground transition-colors">Projects</Link>
                <span>/</span>
                <span className="text-foreground">{project.name}</span>
            </div>

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                {project.description && (
                    <p className="text-muted-foreground mt-1">{project.description}</p>
                )}
            </div>

            <Tabs defaultValue="verticals" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="verticals">Org Chart / Verticals</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="master-dfd">
                        Master DFD
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                            <div>
                                <CardTitle className="text-base">Project Members</CardTitle>
                                <CardDescription className="text-xs">Manage who has access to this project.</CardDescription>
                            </div>
                            <Dialog open={assignUserOpen} onOpenChange={setAssignUserOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">Assign Member</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Assign Project Member</DialogTitle>
                                        <DialogDescription>Assign a user from your organization to this project.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>User</Label>
                                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a user" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableUsers.map(u => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.name} ({u.email})
                                                        </SelectItem>
                                                    ))}
                                                    {availableUsers.length === 0 && (
                                                        <SelectItem value="none" disabled>No available users</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Project Role</Label>
                                            <Select value={assignRole} onValueChange={setAssignRole}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="senior_assessor">Senior Assessor</SelectItem>
                                                    <SelectItem value="analyst">Analyst</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setAssignUserOpen(false)} disabled={assigning}>Cancel</Button>
                                        <Button onClick={handleAssignMember} disabled={assigning || !selectedUser || selectedUser === "none"}>
                                            {assigning ? "Assigning..." : "Assign"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="p-0">
                            {membersLoading ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">Loading members...</div>
                            ) : members.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No members assigned.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((m) => (
                                            <TableRow key={m.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{m.name}</div>
                                                    <div className="text-xs text-muted-foreground">{m.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="capitalize text-xs">
                                                        {m.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {user?.role === "admin" && (
                                                        <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 hover:bg-destructive/10" onClick={() => setRemoveMemberObj(m)}>
                                                            Remove
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>



                <TabsContent value="verticals" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {project.verticals.length} business verticals defined
                        </p>
                        <div className="flex gap-2">
                            {project.verticals.length === 0 && (
                                <Button variant="outline" onClick={handleAddDefaults} disabled={addingDefaults}>
                                    {addingDefaults ? "Adding..." : "Add Default Verticals"}
                                </Button>
                            )}
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                            <path d="M5 12h14" />
                                            <path d="M12 5v14" />
                                        </svg>
                                        Add Vertical
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Vertical</DialogTitle>
                                        <DialogDescription>Add a business vertical to assess.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Vertical Name *</Label>
                                            <Input
                                                placeholder="e.g., Human Resources"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                placeholder="Brief description of this vertical's data handling..."
                                                value={form.description}
                                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Head of Vertical</Label>
                                                <Input
                                                    placeholder="e.g., Jane Smith"
                                                    value={form.headName}
                                                    onChange={(e) => setForm({ ...form, headName: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Role</Label>
                                                <Input
                                                    placeholder="e.g., VP Engineering"
                                                    value={form.headRole}
                                                    onChange={(e) => setForm({ ...form, headRole: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handleCreate} disabled={creating}>
                                            {creating ? "Adding..." : "Add Vertical"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    {project.verticals.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M16 12h-6.5a2 2 0 1 0 0 4H12" />
                                        <path d="M20 12h-2.5" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No verticals defined</h3>
                                <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
                                    Define the business verticals to assess. You can start with the default template
                                    or add them manually.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleAddDefaults}>
                                        Use Default Template
                                    </Button>
                                    <Button onClick={() => setDialogOpen(true)}>Add Custom Vertical</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {project.verticals.map((vertical) => {
                                const status = statusConfig[vertical.assessmentStatus] || statusConfig.not_started;
                                return (
                                    <Link key={vertical.id} href={`/dashboard/projects/${projectId}/verticals/${vertical.id}`}>
                                        <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                                                        {vertical.name}
                                                    </CardTitle>
                                                    {user?.role === "admin" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive z-10"
                                                            onClick={(e) => handleDeleteVertical(e, vertical.id)}
                                                            disabled={deletingVertical && deleteVerticalId === vertical.id}
                                                        >
                                                            {deletingVertical && deleteVerticalId === vertical.id ? (
                                                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25" /><path d="M21 12a9 9 0 00-9-9" /></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                                {vertical.headName && (
                                                    <CardDescription className="text-xs">
                                                        {vertical.headName}{vertical.headRole ? ` · ${vertical.headRole}` : ""}
                                                    </CardDescription>
                                                )}
                                            </CardHeader>
                                            <CardContent className="pt-0 space-y-3">
                                                <div className="flex items-center justify-between text-xs">
                                                    <Badge
                                                        variant="outline"
                                                        className={`${status.color}/10 text-xs border-current`}
                                                    >
                                                        {status.label}
                                                    </Badge>
                                                    <span className="text-muted-foreground">
                                                        {vertical._count.sessions} / {vertical.sessionRunLimit} sessions
                                                    </span>
                                                </div>
                                                {/* Usage Progress bar */}
                                                <div className="space-y-1">
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${vertical._count.sessions >= vertical.sessionRunLimit ? 'bg-destructive' : 'bg-primary'} rounded-full transition-all duration-500`}
                                                            style={{ width: `${Math.min((vertical._count.sessions / (vertical.sessionRunLimit || 1)) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-end pt-1 text-[10px] text-muted-foreground">
                                                        {Math.max(0, vertical.sessionRunLimit - vertical._count.sessions)} assessments remaining
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="master-dfd" className="space-y-4">
                    <div className="grid gap-6 md:grid-cols-12">
                        {/* Left Side: Selection */}
                        <div className="md:col-span-4 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Select Verticals
                                    </CardTitle>
                                    <CardDescription>Select 2+ verticals with finalized sessions.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {project.verticals.map(vertical => {
                                        const hasFinalized = vertical.sessions.length > 0;
                                        return (
                                            <div key={vertical.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox 
                                                        id={`v-${vertical.id}`} 
                                                        disabled={!hasFinalized}
                                                        checked={selectedSessions.has(vertical.id)}
                                                        onCheckedChange={() => handleVerticalToggle(vertical.id)}
                                                    />
                                                    <div>
                                                        <Label 
                                                            htmlFor={`v-${vertical.id}`} 
                                                            className={`text-sm font-medium leading-none cursor-pointer ${!hasFinalized ? 'text-muted-foreground' : ''}`}
                                                        >
                                                            {vertical.name}
                                                        </Label>
                                                        {!hasFinalized && (
                                                            <p className="text-[10px] text-destructive mt-1">No finalized sessions</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {hasFinalized && (
                                                    <Badge variant="secondary" className="text-[10px] h-5">
                                                        {vertical.sessions.length} Session(s)
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    <Separator />
                                    
                                    <div className="pt-2">
                                        <Button 
                                            className="w-full" 
                                            disabled={selectedSessions.size < 2 || generatingMaster}
                                            onClick={generateMasterDfd}
                                        >
                                            {generatingMaster ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4 mr-2" />
                                                    Generate Master DFD
                                                </>
                                            )}
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground mt-2">
                                            {selectedSessions.size} vertical(s) selected
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Side: Status/Results */}
                        <div className="md:col-span-8 space-y-4">
                            {generatingMaster || masterDfdStatus?.status === "processing" ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Activity className="w-4 h-4 animate-pulse text-primary" />
                                            Generation in Progress
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 py-8 text-center">
                                        <div className="max-w-md mx-auto space-y-4">
                                            <p className="text-sm text-muted-foreground">
                                                Aggregating data flows from {selectedSessions.size} verticals...
                                            </p>
                                            <Progress value={masterDfdStatus?.progress_percent || 10} className="h-2" />
                                            <p className="text-xs font-mono text-muted-foreground">
                                                Stage: {masterDfdStatus?.current_stage || "Initializing"}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : masterDfdResults ? (
                                <div className="space-y-4">
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Card>
                                            <CardHeader className="py-2 px-4">
                                                <CardDescription className="text-[10px]">Total Nodes</CardDescription>
                                                <CardTitle className="text-lg">{masterDfdResults.overview_summary?.total_nodes || 0}</CardTitle>
                                            </CardHeader>
                                        </Card>
                                        <Card>
                                            <CardHeader className="py-2 px-4">
                                                <CardDescription className="text-[10px]">Total Flows</CardDescription>
                                                <CardTitle className="text-lg">{masterDfdResults.overview_summary?.total_edges || 0}</CardTitle>
                                            </CardHeader>
                                        </Card>
                                        <Card>
                                            <CardHeader className="py-2 px-4">
                                                <CardDescription className="text-[10px]">Data Elements</CardDescription>
                                                <CardTitle className="text-lg">{masterDfdResults.overview_summary?.total_data_elements || 0}</CardTitle>
                                            </CardHeader>
                                        </Card>
                                        <Card>
                                            <CardHeader className="py-2 px-4">
                                                <CardDescription className="text-[10px]">Risks Found</CardDescription>
                                                <CardTitle className="text-lg text-destructive">{masterDfdResults.overview_summary?.total_risks || 0}</CardTitle>
                                            </CardHeader>
                                        </Card>
                                    </div>

                                    {/* DFD Visual */}
                                    <Card className="overflow-hidden">
                                        <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm">Interactive Master DFD</CardTitle>
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {masterDfdResults.overview_summary?.total_sessions} Sessions Merged
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] bg-primary/5">
                                                    {masterDfdResults.overview_summary?.departments.join(", ")}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0 bg-white min-h-[500px] relative">
                                            {masterDfdResults.dfd_json ? (
                                                <DfdHtmlRenderer dfd={masterDfdResults.dfd_json} />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm italic">
                                                    Visual layout not available
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* AI Executive Summary & Detailed Stats */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <Card className="col-span-1">
                                            <CardHeader className="pb-3 border-b">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-primary" />
                                                    AI Executive Insights
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 overflow-y-auto max-h-[400px]">
                                                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                    {masterDfdResults.overview_summary?.ai_executive_summary}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <div className="space-y-4">
                                            <Card>
                                                <CardHeader className="pb-3 border-b">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                        <ShieldAlert className="w-4 h-4 text-destructive" />
                                                        Risk Breakdown
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(masterDfdResults.overview_summary?.risk_severity_breakdown || {}).map(([severity, count]) => (
                                                            <div key={severity} className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                                                                <span className="text-xs capitalize font-medium">{severity}</span>
                                                                <Badge variant={severity === 'critical' || severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                                                                    {count as number}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="pb-3 border-b">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                        <Database className="w-4 h-4 text-primary" />
                                                        Unique Data Elements
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4 max-h-[200px] overflow-y-auto">
                                                    <div className="flex flex-wrap gap-1">
                                                        {masterDfdResults.overview_summary?.unique_data_elements_list.map((el, i) => (
                                                            <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                                                {el}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <Activity className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-semibold">No Master DFD Generated</h3>
                                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                            Select multiple finalized sessions on the left and click "Generate" to create a cross-vertical data flow diagram.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Delete Vertical Confirmation Dialog */}
            <AlertDialog open={!!deleteVerticalId} onOpenChange={(open) => !open && setDeleteVerticalId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vertical</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{verticalToDelete?.name}</strong>? This will permanently delete all associated sessions and interview data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingVertical}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteVertical}
                            disabled={deletingVertical}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingVertical ? "Deleting..." : "Delete Vertical"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove Member Confirmation Dialog */}
            <AlertDialog open={!!removeMemberObj} onOpenChange={(open) => !open && setRemoveMemberObj(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Project Member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{removeMemberObj?.name}</strong> from this project? They will immediately lose access to all project data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removingMember}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveMember}
                            disabled={removingMember}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removingMember ? "Removing..." : "Remove Member"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
