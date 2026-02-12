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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Org = {
    id: string;
    name: string;
    industry: string | null;
    jurisdiction: string | null;
    regulatoryScope: string[];
    sizeBand: string | null;
    createdAt: string;
    _count: { projects: number };
    creator: { name: string };
};

export default function OrgsPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        name: "",
        industry: "",
        jurisdiction: "",
        sizeBand: "",
    });

    const fetchOrgs = async () => {
        const res = await fetch("/api/orgs");
        if (res.ok) setOrgs(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetchOrgs();
    }, []);

    const handleCreate = async () => {
        if (!form.name.trim()) {
            toast.error("Organization name is required");
            return;
        }
        setCreating(true);
        const res = await fetch("/api/orgs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.name,
                industry: form.industry || null,
                jurisdiction: form.jurisdiction || null,
                sizeBand: form.sizeBand || null,
            }),
        });
        if (res.ok) {
            toast.success("Organization created");
            setDialogOpen(false);
            setForm({ name: "", industry: "", jurisdiction: "", sizeBand: "" });
            fetchOrgs();
        } else {
            toast.error("Failed to create organization");
        }
        setCreating(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
                    <p className="text-muted-foreground">Manage your client organizations and assessments</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            New Organization
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Organization</DialogTitle>
                            <DialogDescription>Add a new client organization for assessment.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="org-name">Organization Name *</Label>
                                <Input
                                    id="org-name"
                                    placeholder="e.g., Acme Corporation"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="org-industry">Industry</Label>
                                <Input
                                    id="org-industry"
                                    placeholder="e.g., Healthcare, Finance, Technology"
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="org-jurisdiction">Jurisdiction</Label>
                                <Input
                                    id="org-jurisdiction"
                                    placeholder="e.g., India, EU, United States"
                                    value={form.jurisdiction}
                                    onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Organization Size</Label>
                                <Select
                                    value={form.sizeBand}
                                    onValueChange={(val) => setForm({ ...form, sizeBand: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="micro">Micro (1-10)</SelectItem>
                                        <SelectItem value="small">Small (11-50)</SelectItem>
                                        <SelectItem value="medium">Medium (51-250)</SelectItem>
                                        <SelectItem value="large">Large (251-1000)</SelectItem>
                                        <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={creating}>
                                {creating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {orgs.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-1">No organizations yet</h3>
                        <p className="text-muted-foreground text-sm mb-4">Create your first organization to get started.</p>
                        <Button onClick={() => setDialogOpen(true)}>Create Organization</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {orgs.map((org) => (
                        <Link key={org.id} href={`/dashboard/orgs/${org.id}`}>
                            <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                                                {org.name}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                {org.industry || "No industry specified"}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="secondary" className="ml-2 shrink-0">
                                            {org._count.projects} {org._count.projects === 1 ? "project" : "projects"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        {org.jurisdiction && (
                                            <span className="flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                                                    <path d="M2 12h20" />
                                                </svg>
                                                {org.jurisdiction}
                                            </span>
                                        )}
                                        {org.sizeBand && (
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {org.sizeBand}
                                            </Badge>
                                        )}
                                    </div>
                                    {org.regulatoryScope.length > 0 && (
                                        <div className="flex gap-1 mt-3 flex-wrap">
                                            {org.regulatoryScope.map((reg) => (
                                                <Badge key={reg} variant="secondary" className="text-xs">
                                                    {reg}
                                                </Badge>
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
    );
}
