"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

type Org = {
    id: string;
    name: string;
    industry: string | null;
    jurisdiction: string | null;
    regulatoryScope: string[];
    sizeBand: string | null;
    projectLimit: number;
    createdAt: string;
    _count: { projects: number; users: number };
    creator: { name: string };
};

type Project = {
    id: string;
    name: string;
    description: string | null;
    status: string;
    assessmentType: string;
    applicableRegulations: string[];
    targetCompletionDate: string | null;
    createdAt: string;
    _count: { verticals: number };
    creator: { name: string };
};

const statusColors: Record<string, string> = {
    setup: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    review: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export default function ProjectsDashboardPage() {
    const { data: session } = useSession();
    const user = session?.user;

    const [org, setOrg] = useState<Org | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        name: "",
        description: "",
        assessmentType: "dfd",
        targetCompletionDate: "",
    });
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const projectToDelete = projects.find((p) => p.id === deleteProjectId);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [orgRes, projRes] = await Promise.all([
                fetch("/api/orgs"),
                fetch("/api/projects")
            ]);

            if (orgRes.ok) {
                const orgData = await orgRes.json();
                if (orgData.success && Array.isArray(orgData.data) && orgData.data.length > 0) {
                    setOrg(orgData.data[0]);
                }
            }
            if (projRes.ok) {
                const projData = await projRes.json();
                if (projData.success) {
                    setProjects(projData.data);
                }
            }
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!org) return;
        if (!form.name.trim()) {
            toast.error("Project name is required");
            return;
        }
        setCreating(true);
        const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orgId: org.id,
                name: form.name,
                description: form.description || null,
                assessmentType: form.assessmentType,
                targetCompletionDate: form.targetCompletionDate || null,
            }),
        });
        if (res.ok) {
            toast.success("Project created");
            setDialogOpen(false);
            setForm({ name: "", description: "", assessmentType: "dfd", targetCompletionDate: "" });
            fetchData();
        } else {
            toast.error("Failed to create project");
        }
        setCreating(false);
    };

    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteProjectId(projectId);
    };

    const confirmDeleteProject = async () => {
        if (!deleteProjectId) return;
        const name = projectToDelete?.name || "project";
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${name}...`);
        try {
            const res = await fetch(`/api/projects/${deleteProjectId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success(`${name} deleted successfully`, { id: toastId });
                setDeleteProjectId(null);
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete project", { id: toastId });
            }
        } catch {
            toast.error("Network error deleting project", { id: toastId });
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
                <Separator />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-muted-foreground">You are not assigned to an organization.</p>
                <p className="text-sm text-muted-foreground">Please contact your administrator.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {org.industry && <span>{org.industry}</span>}
                        {org.jurisdiction && (
                            <>
                                <Separator orientation="vertical" className="h-4" />
                                <span>{org.jurisdiction}</span>
                            </>
                        )}
                        {org.sizeBand && (
                            <>
                                <Separator orientation="vertical" className="h-4" />
                                <Badge variant="outline" className="capitalize">{org.sizeBand}</Badge>
                            </>
                        )}
                    </div>
                    {/* {org.regulatoryScope.length > 0 && (
                        <div className="flex gap-1 mt-2">
                            {org.regulatoryScope.map((reg) => (
                                <Badge key={reg} variant="secondary" className="text-xs">
                                    {reg}
                                </Badge>
                            ))}
                        </div>
                    )} */}
                </div>

                {user?.role === "admin" && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={projects.length >= org.projectLimit}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                </svg>
                                {projects.length >= org.projectLimit ? "Limit Reached" : "New Project"}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Project</DialogTitle>
                                <DialogDescription>Create a new assessment project for {org.name}.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="proj-name">Project Name *</Label>
                                    <Input
                                        id="proj-name"
                                        placeholder="e.g., DPDPA Compliance 2026"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="proj-desc">Description</Label>
                                    <Textarea
                                        id="proj-desc"
                                        placeholder="Brief description of the assessment scope..."
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Assessment Type</Label>
                                        <Select
                                            value={form.assessmentType}
                                            onValueChange={(val) => setForm({ ...form, assessmentType: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dfd">DFD</SelectItem>
                                                <SelectItem value="full_pia" disabled>Full PIA</SelectItem>
                                                <SelectItem value="dpia" disabled>DPIA</SelectItem>
                                                <SelectItem value="ai_governance" disabled>AI Governance</SelectItem>
                                                <SelectItem value="custom" disabled>Custom</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="proj-date">Creation Date</Label>
                                        <Input
                                            id="proj-date"
                                            type="date"
                                            value={form.targetCompletionDate}
                                            onChange={(e) => setForm({ ...form, targetCompletionDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreate} disabled={creating}>
                                    {creating ? "Creating..." : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Separator />

            {/* Projects */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Projects ({projects.length} / {org.projectLimit})</h2>
                    {projects.length >= org.projectLimit && (
                        <span className="text-sm text-destructive">Project limit reached. Please contact support to upgrade.</span>
                    )}
                </div>
                {projects.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                            {user?.role === "admin" ? (
                                <>
                                    <p className="text-muted-foreground text-sm mb-4">Create your first assessment project.</p>
                                    <Button onClick={() => setDialogOpen(true)}>Create Project</Button>
                                </>
                            ) : (
                                <p className="text-muted-foreground text-sm mb-4">You have not been assigned any projects.</p>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                                <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full flex flex-col">
                                    <CardHeader className="pb-3 flex-none">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                {project.name}
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={statusColors[project.status] || ""}
                                                >
                                                    {project.status.replace("_", " ")}
                                                </Badge>
                                                {/* <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive z-10"
                                                    onClick={(e) => handleDeleteProject(e, project.id)}
                                                    disabled={deleting && deleteProjectId === project.id}
                                                >
                                                    {deleting && deleteProjectId === project.id ? (
                                                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25" /><path d="M21 12a9 9 0 00-9-9" /></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                    )}
                                                </Button> */}
                                            </div>
                                        </div>
                                        {project.description && (
                                            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="pt-0 flex-1 flex flex-col justify-end">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                            <span>{project._count?.verticals || 0} verticals</span>
                                            <span className="capitalize">{project.assessmentType.replace("_", " ")}</span>
                                        </div>
                                        {project.applicableRegulations.length > 0 && (
                                            <div className="flex gap-1 mt-2 flex-wrap">
                                                {project.applicableRegulations.map((reg) => (
                                                    <Badge key={reg} variant="secondary" className="text-[10px]">{reg}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
            {/* Delete Project Confirmation Dialog */}
            <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{projectToDelete?.name}</strong>? This will permanently delete all associated verticals, sessions, and interview data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteProject}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting..." : "Delete Project"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
