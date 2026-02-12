"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type OrgDetail = {
    id: string;
    name: string;
    industry: string | null;
    jurisdiction: string | null;
    regulatoryScope: string[];
    sizeBand: string | null;
    projects: {
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
    }[];
};

const statusColors: Record<string, string> = {
    setup: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    review: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export default function OrgDetailPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const [org, setOrg] = useState<OrgDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        name: "",
        description: "",
        assessmentType: "full_pia",
        targetCompletionDate: "",
    });

    const fetchOrg = async () => {
        const res = await fetch(`/api/orgs/${orgId}`);
        if (res.ok) setOrg(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetchOrg();
    }, [orgId]);

    const handleCreate = async () => {
        if (!form.name.trim()) {
            toast.error("Project name is required");
            return;
        }
        setCreating(true);
        const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orgId,
                name: form.name,
                description: form.description || null,
                assessmentType: form.assessmentType,
                targetCompletionDate: form.targetCompletionDate || null,
            }),
        });
        if (res.ok) {
            toast.success("Project created");
            setDialogOpen(false);
            setForm({ name: "", description: "", assessmentType: "full_pia", targetCompletionDate: "" });
            fetchOrg();
        } else {
            toast.error("Failed to create project");
        }
        setCreating(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
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
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Organization not found</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/orgs" className="hover:text-foreground transition-colors">
                    Organizations
                </Link>
                <span>/</span>
                <span className="text-foreground">{org.name}</span>
            </div>

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
                    {org.regulatoryScope.length > 0 && (
                        <div className="flex gap-1 mt-2">
                            {org.regulatoryScope.map((reg) => (
                                <Badge key={reg} variant="secondary" className="text-xs">
                                    {reg}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            New Project
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
                                            <SelectItem value="full_pia">Full PIA</SelectItem>
                                            <SelectItem value="dpia">DPIA</SelectItem>
                                            <SelectItem value="ai_governance">AI Governance</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="proj-date">Target Date</Label>
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
            </div>

            <Separator />

            {/* Projects */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Projects ({org.projects.length})</h2>
                {org.projects.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                            <p className="text-muted-foreground text-sm mb-4">Create your first assessment project.</p>
                            <Button onClick={() => setDialogOpen(true)}>Create Project</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {org.projects.map((project) => (
                            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                                <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                {project.name}
                                            </CardTitle>
                                            <Badge
                                                variant="outline"
                                                className={statusColors[project.status] || ""}
                                            >
                                                {project.status.replace("_", " ")}
                                            </Badge>
                                        </div>
                                        {project.description && (
                                            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{project._count.verticals} verticals</span>
                                            <span className="capitalize">{project.assessmentType.replace("_", " ")}</span>
                                        </div>
                                        {project.applicableRegulations.length > 0 && (
                                            <div className="flex gap-1 mt-2 flex-wrap">
                                                {project.applicableRegulations.map((reg) => (
                                                    <Badge key={reg} variant="secondary" className="text-xs">{reg}</Badge>
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
        </div>
    );
}
