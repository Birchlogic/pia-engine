"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";

type Vertical = {
    id: string;
    name: string;
    description: string | null;
    headName: string | null;
    headRole: string | null;
    assessmentStatus: string;
    _count: { sessions: number };
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
    const { projectId } = useParams<{ projectId: string }>();
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [addingDefaults, setAddingDefaults] = useState(false);
    const [form, setForm] = useState({ name: "", description: "", headName: "", headRole: "" });

    const fetchProject = async () => {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) setProject(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetchProject();
    }, [projectId]);

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
                <Link href="/dashboard/orgs" className="hover:text-foreground transition-colors">Organizations</Link>
                <span>/</span>
                <Link href={`/dashboard/orgs/${project.organization.id}`} className="hover:text-foreground transition-colors">
                    {project.organization.name}
                </Link>
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
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="master-dfd" disabled={
                        !project.verticals.some((v) => v.assessmentStatus === "dfd_generated")
                    }>
                        Master DFD
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Verticals</CardDescription>
                                <CardTitle className="text-3xl">{project.verticals.length}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Completed</CardDescription>
                                <CardTitle className="text-3xl text-green-500">
                                    {project.verticals.filter((v) => v.assessmentStatus === "dfd_generated").length}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Sessions</CardDescription>
                                <CardTitle className="text-3xl">
                                    {project.verticals.reduce((sum, v) => sum + v._count.sessions, 0)}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
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
                                                        {vertical._count.sessions} sessions
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${status.color} rounded-full transition-all duration-500`}
                                                        style={{ width: `${status.percent}%` }}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="master-dfd">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <p className="text-muted-foreground">
                                Master DFD will be available once 2+ vertical DFDs are generated.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
