"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { formatError } from "@/lib/utils";

interface MasterKgRisk {
    description: string;
    severity: string;
    risk_name?: string;
    source?: string;
}

interface MasterKgNode {
    id: string;
    name: string;
    type: string;
    aliases: string[];
    data_elements: string[];
    risks: MasterKgRisk[];
    sources: string[];
    _source_sessions: string[];
}

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
    master_kg?: {
        nodes: MasterKgNode[];
        edges: any[];
        dialogue_records?: any[];
    };
    master_render_plan?: any;
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

    // Bulk vertical delete
    const [bulkSelectMode, setBulkSelectMode] = useState(false);
    const [selectedVerticalIds, setSelectedVerticalIds] = useState<Set<string>>(new Set());
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);

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
    const [summaryExpanded, setSummaryExpanded] = useState(false);
    const [masterDfdSubTab, setMasterDfdSubTab] = useState<"overview" | "dfd">("overview");
    const [selectedRiskSeverity, setSelectedRiskSeverity] = useState<string | null>(null);
    const [riskDetailsOpen, setRiskDetailsOpen] = useState(false);

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

    const toggleVerticalSelection = (verticalId: string) => {
        setSelectedVerticalIds((prev) => {
            const next = new Set(prev);
            if (next.has(verticalId)) next.delete(verticalId);
            else next.add(verticalId);
            return next;
        });
    };

    const clearVerticalSelection = () => {
        setSelectedVerticalIds(new Set());
    };

    const selectAllVerticals = () => {
        const all = new Set((project?.verticals || []).map((v) => v.id));
        setSelectedVerticalIds(all);
    };

    const confirmBulkDeleteVerticals = async () => {
        if (bulkDeleting) return;
        const ids = Array.from(selectedVerticalIds);
        if (ids.length === 0) return;

        setBulkDeleting(true);
        const toastId = toast.loading(`Deleting ${ids.length} vertical(s)...`);
        let deleted = 0;
        let failed = 0;

        for (const id of ids) {
            try {
                const res = await fetch(`/api/verticals/${id}`, { method: "DELETE" });
                if (res.ok) {
                    deleted += 1;
                } else {
                    failed += 1;
                }
                toast.loading(`Deleting verticals... (${deleted + failed}/${ids.length})`, { id: toastId });
            } catch {
                failed += 1;
                toast.loading(`Deleting verticals... (${deleted + failed}/${ids.length})`, { id: toastId });
            }
        }

        if (failed === 0) {
            toast.success(`Deleted ${deleted} vertical(s)`, { id: toastId });
        } else {
            toast.error(`Deleted ${deleted}. Failed ${failed}.`, { id: toastId });
        }

        setBulkDeleting(false);
        setBulkDeleteDialogOpen(false);
        setBulkSelectMode(false);
        clearVerticalSelection();
        fetchProject();
    };

    const handleAddDefaults = async () => {
        if (addingDefaults) return;
        setAddingDefaults(true);
        const toastId = toast.loading("Adding default verticals...");
        try {
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
            toast.success(`Added ${toAdd.length} default verticals`, { id: toastId });
            fetchProject();
        } catch {
            toast.error("Failed to add default verticals", { id: toastId });
        } finally {
            setAddingDefaults(false);
        }
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
                            {user?.role === "admin" && project.verticals.length > 0 && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (bulkDeleting) return;
                                            setBulkSelectMode((v) => {
                                                const next = !v;
                                                if (!next) clearVerticalSelection();
                                                return next;
                                            });
                                        }}
                                        disabled={bulkDeleting || deletingVertical}
                                    >
                                        {bulkSelectMode ? "Cancel Select" : "Select"}
                                    </Button>

                                    {bulkSelectMode && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={selectAllVerticals}
                                                disabled={bulkDeleting || project.verticals.length === 0}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={clearVerticalSelection}
                                                disabled={bulkDeleting || selectedVerticalIds.size === 0}
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => setBulkDeleteDialogOpen(true)}
                                                disabled={bulkDeleting || selectedVerticalIds.size === 0}
                                            >
                                                {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedVerticalIds.size})`}
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
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
                                            <Label>Description *</Label>
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
                                    <Button variant="outline" onClick={handleAddDefaults} disabled={addingDefaults}>
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
                                const isSelected = selectedVerticalIds.has(vertical.id);
                                return (
                                    bulkSelectMode ? (
                                        <div
                                            key={vertical.id}
                                            className="relative"
                                            onClick={() => toggleVerticalSelection(vertical.id)}
                                        >
                                            <div className="absolute left-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleVerticalSelection(vertical.id)}
                                                    disabled={bulkDeleting}
                                                />
                                            </div>
                                            <Card
                                                className={`transition-colors cursor-pointer group h-full ${
                                                    isSelected ? "border-primary/70 ring-2 ring-primary/20" : "hover:border-primary/50"
                                                }`}
                                            >
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                                                            {vertical.name}
                                                        </CardTitle>
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
                                        </div>
                                    ) : (
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
                                                    {/* <span className="text-muted-foreground">
                                                        {vertical._count.sessions} / {vertical.sessionRunLimit} sessions
                                                    </span> */}
                                                </div>
                                                {/* Usage Progress bar */}
                                                <div className="space-y-1">
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${vertical._count.sessions >= vertical.sessionRunLimit ? 'bg-destructive' : 'bg-primary'} rounded-full transition-all duration-500`}
                                                            style={{ width: `${Math.min((vertical._count.sessions / (vertical.sessionRunLimit || 1)) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    {/* <div className="flex justify-end pt-1 text-[10px] text-muted-foreground">
                                                        {Math.max(0, vertical.sessionRunLimit - vertical._count.sessions)} assessments remaining
                                                    </div> */}
                                                </div>
                                            </CardContent>
                                            </Card>
                                        </Link>
                                    )
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete selected verticals?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {selectedVerticalIds.size} vertical(s) and their associated data. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmBulkDeleteVerticals}
                                disabled={bulkDeleting || selectedVerticalIds.size === 0}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {bulkDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
                                    {/* Sub-tabs for Overview and DFD */}
                                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
                                        <button
                                            onClick={() => setMasterDfdSubTab("overview")}
                                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                masterDfdSubTab === "overview"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            Overview
                                        </button>
                                        <button
                                            onClick={() => (masterDfdResults.master_html || masterDfdResults.dfd_json) && setMasterDfdSubTab("dfd")}
                                            disabled={!masterDfdResults.master_html && !masterDfdResults.dfd_json}
                                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                masterDfdSubTab === "dfd"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : (!masterDfdResults.master_html && !masterDfdResults.dfd_json)
                                                    ? "text-muted-foreground/50 cursor-not-allowed"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            DFD Visualization
                                        </button>
                                    </div>

                                    {/* Overview Tab */}
                                    {masterDfdSubTab === "overview" && (
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

                                            {/* Risk Assessment & Unique Data Elements - Moved to Top */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <Card>
                                                    <CardHeader className="pb-3 border-b">
                                                        <CardTitle className="text-sm flex items-center gap-2">
                                                            <ShieldAlert className="w-4 h-4 text-destructive" />
                                                            Risk Assessment
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="pt-4">
                                                        <div className="space-y-2">
                                                        {Object.entries(masterDfdResults.overview_summary?.risk_severity_breakdown || {}).map(([severity, count]) => (
                                                            <div 
                                                                key={severity} 
                                                                className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                                                                onClick={() => {
                                                                    setSelectedRiskSeverity(severity);
                                                                    setRiskDetailsOpen(true);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${
                                                                        severity === 'critical' ? 'bg-red-500' :
                                                                        severity === 'high' ? 'bg-orange-500' :
                                                                        severity === 'medium' ? 'bg-yellow-500' :
                                                                        'bg-blue-500'
                                                                    }`} />
                                                                    <span className="text-sm capitalize font-medium">{severity}</span>
                                                                </div>
                                                                <Badge 
                                                                    variant={severity === 'critical' || severity === 'high' ? 'destructive' : 'secondary'} 
                                                                    className="text-xs px-2.5 py-0.5"
                                                                >
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
                                                        <CardDescription className="text-xs mt-1">
                                                            {masterDfdResults.overview_summary?.unique_data_elements_list?.length || 0} unique elements identified
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="pt-4 max-h-[220px] overflow-y-auto">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {masterDfdResults.overview_summary?.unique_data_elements_list?.map((el, i) => (
                                                                <Badge 
                                                                    key={i} 
                                                                    variant="outline" 
                                                                    className="text-xs font-normal px-2.5 py-1 hover:bg-primary/10 transition-colors cursor-default"
                                                                >
                                                                    {el}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            {/* AI Executive Insights - Now Expandable */}
                                            <Card>
                                                <CardHeader className="pb-3 border-b">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-primary" />
                                                        AI Executive Insights
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4">
                                                    {!summaryExpanded ? (
                                                        <div className="text-sm text-muted-foreground leading-relaxed">
                                                            {(masterDfdResults.overview_summary?.ai_executive_summary || "").replace(/[#*_`]/g, '').substring(0, 300).trim()}...
                                                            <button
                                                                onClick={() => setSummaryExpanded(true)}
                                                                className="ml-1 text-primary hover:underline font-semibold inline"
                                                            >
                                                                See more
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <MarkdownRenderer 
                                                                content={masterDfdResults.overview_summary?.ai_executive_summary || ""}
                                                                className="text-muted-foreground"
                                                            />
                                                            <button
                                                                onClick={() => setSummaryExpanded(false)}
                                                                className="mt-3 text-primary hover:underline font-semibold text-sm"
                                                            >
                                                                See less
                                                            </button>
                                                        </>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* DFD Tab */}
                                    {masterDfdSubTab === "dfd" && (masterDfdResults.master_html || masterDfdResults.dfd_json) && (
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
                                                {masterDfdResults.master_html ? (
                                                    <iframe
                                                        srcDoc={masterDfdResults.master_html}
                                                        className="w-full border-none"
                                                        style={{ minHeight: '800px', height: '90vh' }}
                                                        title="Master Data Flow Diagram"
                                                        sandbox="allow-scripts allow-same-origin allow-modals allow-downloads allow-popups"
                                                    />
                                                ) : masterDfdResults.dfd_json ? (
                                                    <DfdHtmlRenderer dfd={masterDfdResults.dfd_json} />
                                                ) : null}
                                            </CardContent>
                                        </Card>
                                    )}
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

            {/* Risk Details Drawer */}
            <Sheet open={riskDetailsOpen} onOpenChange={setRiskDetailsOpen}>
                <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                                selectedRiskSeverity === 'critical' ? 'bg-red-500' :
                                selectedRiskSeverity === 'high' ? 'bg-orange-500' :
                                selectedRiskSeverity === 'medium' ? 'bg-yellow-500' :
                                'bg-blue-500'
                            }`} />
                            <span className="capitalize">{selectedRiskSeverity} Risks</span>
                            <Badge 
                                variant={selectedRiskSeverity === 'critical' || selectedRiskSeverity === 'high' ? 'destructive' : 'secondary'}
                                className="ml-1"
                            >
                                {masterDfdResults?.overview_summary?.risk_severity_breakdown?.[selectedRiskSeverity || ''] || 0}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription>
                            All identified risks at {selectedRiskSeverity} severity
                        </SheetDescription>
                    </SheetHeader>

                    <Separator className="my-4" />

                    <div className="space-y-4">
                        {(() => {
                            // Extract risks from master_kg nodes, grouped with their parent node info
                            const risksWithNodes: Array<{
                                risk: MasterKgRisk;
                                nodeName: string;
                                nodeType: string;
                                nodeId: string;
                                dataElements: string[];
                            }> = [];

                            (masterDfdResults?.master_kg?.nodes || []).forEach((node: MasterKgNode) => {
                                (node.risks || []).forEach((risk: MasterKgRisk) => {
                                    if (risk.severity?.toLowerCase() === selectedRiskSeverity?.toLowerCase()) {
                                        risksWithNodes.push({
                                            risk,
                                            nodeName: node.name,
                                            nodeType: node.type,
                                            nodeId: node.id,
                                            dataElements: node.data_elements || [],
                                        });
                                    }
                                });
                            });

                            if (risksWithNodes.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <ShieldAlert className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm text-muted-foreground">No detailed risk data available for this severity level.</p>
                                    </div>
                                );
                            }

                            return risksWithNodes.map((item, idx) => (
                                <Card key={idx} className="border-l-4" style={{
                                    borderLeftColor:
                                        item.risk.severity === 'critical' ? '#ef4444' :
                                        item.risk.severity === 'high' ? '#f97316' :
                                        item.risk.severity === 'medium' ? '#eab308' :
                                        '#3b82f6'
                                }}>
                                    <CardContent className="pt-4 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <span className="text-sm font-semibold">
                                                    {item.risk.risk_name || `Risk #${idx + 1}`}
                                                </span>
                                            </div>
                                            <Badge 
                                                variant={item.risk.severity === 'critical' || item.risk.severity === 'high' ? 'destructive' : 'secondary'}
                                                className="capitalize flex-shrink-0"
                                            >
                                                {item.risk.severity}
                                            </Badge>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                            <p className="text-sm leading-relaxed">{item.risk.description}</p>
                                        </div>

                                        {/* Affected Node */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Affected Node</p>
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                    item.nodeType === 'system' ? 'bg-blue-500' :
                                                    item.nodeType === 'actor' ? 'bg-green-500' :
                                                    item.nodeType === 'external_entity' ? 'bg-purple-500' :
                                                    'bg-gray-400'
                                                }`} />
                                                <span className="text-sm font-medium">{item.nodeName}</span>
                                                <Badge variant="outline" className="text-[10px] capitalize">{item.nodeType.replace(/_/g, ' ')}</Badge>
                                            </div>
                                        </div>

                                        {/* Data Elements at risk */}
                                        {item.dataElements.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-2">Data Elements at Risk ({item.dataElements.length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.dataElements.map((el: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            {el}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Source */}
                                        {item.risk.source && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">Source</p>
                                                <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 inline-block font-mono">
                                                    {item.risk.source}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ));
                        })()}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
