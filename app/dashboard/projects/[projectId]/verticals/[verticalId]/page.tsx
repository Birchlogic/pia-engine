"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DataMatrixTable } from "@/components/data-matrix/data-matrix-table";
import { GenerationProgress } from "@/components/data-matrix/generation-progress";
import type { MatrixRow } from "@/components/data-matrix/matrix-columns";

type Session = {
    id: string;
    sessionDate: string;
    sessionNumber: number;
    intervieweeNames: string[];
    intervieweeRoles: string[];
    assessmentCriteriaTags: string[];
    status: string;
    version: number;
    rawTextNotes: string | null;
    aiSummary: string | null;
    _count: { files: number };
    creator: { name: string };
};

type VerticalDetail = {
    id: string;
    name: string;
    description: string | null;
    headName: string | null;
    headRole: string | null;
    assessmentStatus: string;
    project: {
        id: string;
        name: string;
        organization: { id: string; name: string };
    };
    sessions: Session[];
    dataMatrix: { id: string; status: string } | null;
    _count: { sessions: number; matrixRows: number };
};

const criteriaLabels: Record<string, string> = {
    data_collection: "Data Collection",
    data_storage: "Data Storage",
    data_processing: "Data Processing",
    data_sharing_internal: "Internal Sharing",
    data_sharing_external: "External Sharing",
    cross_border_transfers: "Cross-Border",
    retention_deletion: "Retention & Deletion",
    access_controls: "Access Controls",
    consent_mechanisms: "Consent",
    ai_ml_usage: "AI/ML Usage",
    third_party_management: "Third-Party Mgmt",
    security_measures: "Security",
};

const allCriteria = Object.entries(criteriaLabels);

export default function VerticalWorkspacePage() {
    const { projectId, verticalId } = useParams<{ projectId: string; verticalId: string }>();
    const [vertical, setVertical] = useState<VerticalDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // New session dialog
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newForm, setNewForm] = useState({
        intervieweeNames: "",
        intervieweeRoles: "",
        rawTextNotes: "",
        selectedTags: [] as string[],
    });

    // Add notes dialog
    const [notesDialogOpen, setNotesDialogOpen] = useState(false);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [appendNotes, setAppendNotes] = useState("");
    const [saving, setSaving] = useState(false);

    // Expanded sessions
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

    // Matrix generation
    const [generating, setGenerating] = useState(false);
    const [generationJobId, setGenerationJobId] = useState<string | null>(null);
    const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
    const [matrixLoaded, setMatrixLoaded] = useState(false);

    const fetchVertical = useCallback(async () => {
        const res = await fetch(`/api/verticals/${verticalId}`);
        if (res.ok) setVertical(await res.json());
        setLoading(false);
    }, [verticalId]);

    const fetchMatrixRows = useCallback(async () => {
        const res = await fetch(`/api/matrix?verticalId=${verticalId}`);
        if (res.ok) {
            const data = await res.json();
            setMatrixRows(data.rows || []);
        }
        setMatrixLoaded(true);
    }, [verticalId]);

    useEffect(() => {
        fetchVertical();
        fetchMatrixRows();
    }, [fetchVertical, fetchMatrixRows]);

    const handleCreateSession = async () => {
        if (!newForm.rawTextNotes.trim()) {
            toast.error("Please add interview notes");
            return;
        }
        setCreating(true);
        const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                verticalId,
                intervieweeNames: newForm.intervieweeNames
                    .split(",")
                    .map((n) => n.trim())
                    .filter(Boolean),
                intervieweeRoles: newForm.intervieweeRoles
                    .split(",")
                    .map((r) => r.trim())
                    .filter(Boolean),
                rawTextNotes: newForm.rawTextNotes,
                assessmentCriteriaTags: newForm.selectedTags,
            }),
        });
        if (res.ok) {
            toast.success("Session created");
            setNewDialogOpen(false);
            setNewForm({ intervieweeNames: "", intervieweeRoles: "", rawTextNotes: "", selectedTags: [] });
            fetchVertical();
        } else {
            toast.error("Failed to create session");
        }
        setCreating(false);
    };

    const handleAppendNotes = async () => {
        if (!activeSession || !appendNotes.trim()) {
            toast.error("Please add some notes");
            return;
        }
        setSaving(true);
        const res = await fetch(`/api/sessions/${activeSession.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appendNotes: appendNotes }),
        });
        if (res.ok) {
            toast.success("Notes added — version bumped");
            setNotesDialogOpen(false);
            setAppendNotes("");
            setActiveSession(null);
            fetchVertical();
        } else {
            toast.error("Failed to save notes");
        }
        setSaving(false);
    };

    const handleFinalizeSession = async (sessionId: string) => {
        const res = await fetch(`/api/sessions/${sessionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "finalized" }),
        });
        if (res.ok) {
            toast.success("Session finalized");
            fetchVertical();
        } else {
            toast.error("Failed to finalize session");
        }
    };

    const handleGenerateMatrix = async () => {
        setGenerating(true);
        const res = await fetch("/api/ai/generate-matrix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verticalId }),
        });
        if (res.ok) {
            const data = await res.json();
            setGenerationJobId(data.jobId);
        } else {
            toast.error("Failed to start matrix generation");
            setGenerating(false);
        }
    };

    const toggleExpanded = (id: string) => {
        setExpandedSessions((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!vertical) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Vertical not found</p>
            </div>
        );
    }

    const finalizedSessions = vertical.sessions.filter((s) => s.status === "finalized");
    const hasMatrix = matrixRows.length > 0;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Link href="/dashboard/orgs" className="hover:text-foreground transition-colors">
                    Organizations
                </Link>
                <span>/</span>
                <Link
                    href={`/dashboard/orgs/${vertical.project.organization.id}`}
                    className="hover:text-foreground transition-colors"
                >
                    {vertical.project.organization.name}
                </Link>
                <span>/</span>
                <Link
                    href={`/dashboard/projects/${vertical.project.id}`}
                    className="hover:text-foreground transition-colors"
                >
                    {vertical.project.name}
                </Link>
                <span>/</span>
                <span className="text-foreground">{vertical.name}</span>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{vertical.name}</h1>
                    {vertical.headName && (
                        <p className="text-muted-foreground mt-1">
                            Head: {vertical.headName}
                            {vertical.headRole ? ` (${vertical.headRole})` : ""}
                        </p>
                    )}
                </div>
            </div>

            <Tabs defaultValue="sessions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sessions">Sessions ({vertical.sessions.length})</TabsTrigger>
                    <TabsTrigger value="matrix">
                        Data Matrix {hasMatrix ? `(${matrixRows.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="dfd" disabled={vertical.assessmentStatus !== "dfd_generated"}>
                        DFD
                    </TabsTrigger>
                </TabsList>

                {/* ────────────── Sessions Tab ────────────── */}
                <TabsContent value="sessions" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {finalizedSessions.length} finalized, {vertical.sessions.length - finalizedSessions.length} drafts
                        </p>

                        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                        <path d="M5 12h14" />
                                        <path d="M12 5v14" />
                                    </svg>
                                    New Session
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create Interview Session</DialogTitle>
                                    <DialogDescription>
                                        Record a new assessment interview for {vertical.name}.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Interviewee Name(s)</Label>
                                            <Input
                                                placeholder="Comma-separated, e.g. Priya Sharma, Raj Kumar"
                                                value={newForm.intervieweeNames}
                                                onChange={(e) => setNewForm({ ...newForm, intervieweeNames: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Role(s)</Label>
                                            <Input
                                                placeholder="e.g. VP HR, Manager"
                                                value={newForm.intervieweeRoles}
                                                onChange={(e) => setNewForm({ ...newForm, intervieweeRoles: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Assessment Criteria Tags</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {allCriteria.map(([key, label]) => (
                                                <Badge
                                                    key={key}
                                                    variant={newForm.selectedTags.includes(key) ? "default" : "outline"}
                                                    className="cursor-pointer transition-colors"
                                                    onClick={() =>
                                                        setNewForm((prev) => ({
                                                            ...prev,
                                                            selectedTags: prev.selectedTags.includes(key)
                                                                ? prev.selectedTags.filter((t) => t !== key)
                                                                : [...prev.selectedTags, key],
                                                        }))
                                                    }
                                                >
                                                    {label}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Interview Notes *</Label>
                                        <Textarea
                                            placeholder="Paste or type your interview notes, observations, and findings here..."
                                            value={newForm.rawTextNotes}
                                            onChange={(e) => setNewForm({ ...newForm, rawTextNotes: e.target.value })}
                                            rows={12}
                                            className="font-mono text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            You can always add more context later using the + button on the session card.
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateSession} disabled={creating}>
                                        {creating ? "Creating..." : "Create Session"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Sessions list */}
                    {vertical.sessions.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No interview sessions</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    Record your first assessment session.
                                </p>
                                <Button onClick={() => setNewDialogOpen(true)}>Create Session</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {vertical.sessions.map((session) => (
                                <Collapsible
                                    key={session.id}
                                    open={expandedSessions.has(session.id)}
                                    onOpenChange={() => toggleExpanded(session.id)}
                                >
                                    <Card className="hover:border-primary/30 transition-colors">
                                        <CardHeader className="py-4">
                                            <div className="flex items-start justify-between">
                                                <CollapsibleTrigger asChild>
                                                    <div className="flex-1 cursor-pointer">
                                                        <div className="flex items-center gap-2">
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSessions.has(session.id) ? "rotate-90" : ""
                                                                    }`}
                                                            >
                                                                <path d="m9 18 6-6-6-6" />
                                                            </svg>
                                                            <CardTitle className="text-base">
                                                                Session #{session.sessionNumber}
                                                            </CardTitle>
                                                            <Badge
                                                                variant={session.status === "finalized" ? "default" : "outline"}
                                                                className="text-xs"
                                                            >
                                                                {session.status === "finalized" ? "✓ Finalized" : "Draft"}
                                                            </Badge>
                                                            {session.version > 1 && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    v{session.version}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <CardDescription className="mt-1 ml-6">
                                                            {new Date(session.sessionDate).toLocaleDateString("en-US", {
                                                                weekday: "short",
                                                                year: "numeric",
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                            {session.intervieweeNames.length > 0 && (
                                                                <> · {session.intervieweeNames.join(", ")}</>
                                                            )}
                                                        </CardDescription>
                                                    </div>
                                                </CollapsibleTrigger>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Add more notes to this session"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveSession(session);
                                                            setAppendNotes("");
                                                            setNotesDialogOpen(true);
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                            <path d="M5 12h14" />
                                                            <path d="M12 5v14" />
                                                        </svg>
                                                    </Button>
                                                    {session.status === "draft" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title="Finalize this session"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFinalizeSession(session.id);
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        </Button>
                                                    )}
                                                    {session._count.files > 0 && (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                            </svg>
                                                            {session._count.files}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {session.assessmentCriteriaTags.length > 0 && (
                                                <div className="flex gap-1 mt-2 ml-6 flex-wrap">
                                                    {session.assessmentCriteriaTags.map((tag) => (
                                                        <Badge key={tag} variant="secondary" className="text-xs">
                                                            {criteriaLabels[tag] || tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </CardHeader>

                                        <CollapsibleContent>
                                            <CardContent className="pt-0 pb-4">
                                                <Separator className="mb-4" />
                                                {session.rawTextNotes ? (
                                                    <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                                        <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                                                            {session.rawTextNotes}
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground text-sm italic">
                                                        No notes recorded yet. Click the + button to add content.
                                                    </p>
                                                )}
                                                {session.aiSummary && (
                                                    <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                                                        <p className="text-xs font-medium text-primary mb-2">AI Summary</p>
                                                        <p className="text-sm">{session.aiSummary}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </CollapsibleContent>
                                    </Card>
                                </Collapsible>
                            ))}
                        </div>
                    )}

                    {/* Generate Data Matrix */}
                    {finalizedSessions.length > 0 && (
                        <>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {finalizedSessions.length} finalized session(s) ready for matrix generation
                                </p>
                                <Button
                                    variant="default"
                                    disabled={generating}
                                    onClick={handleGenerateMatrix}
                                >
                                    {hasMatrix ? "Regenerate Data Matrix" : "Generate Data Matrix"}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Generation progress */}
                    {generating && generationJobId && (
                        <GenerationProgress
                            jobId={generationJobId}
                            onComplete={() => {
                                setGenerating(false);
                                setGenerationJobId(null);
                                fetchVertical();
                                fetchMatrixRows();
                                toast.success("Data Matrix generated!");
                            }}
                            onError={(msg) => {
                                setGenerating(false);
                                setGenerationJobId(null);
                                toast.error(`Generation failed: ${msg}`);
                            }}
                        />
                    )}
                </TabsContent>

                {/* ────────────── Data Matrix Tab ────────────── */}
                <TabsContent value="matrix" className="space-y-4">
                    {!matrixLoaded ? (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : matrixRows.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                        <line x1="3" x2="21" y1="9" y2="9" />
                                        <line x1="3" x2="21" y1="15" y2="15" />
                                        <line x1="9" x2="9" y1="3" y2="21" />
                                        <line x1="15" x2="15" y1="3" y2="21" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No Data Matrix yet</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    Finalize your interview sessions, then generate the Data Matrix from the Sessions tab.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <DataMatrixTable rows={matrixRows} onRefresh={fetchMatrixRows} />
                    )}
                </TabsContent>

                {/* ────────────── DFD Tab ────────────── */}
                <TabsContent value="dfd">
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">DFD canvas coming in Sprint 4</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Add Notes Dialog */}
            <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Add Notes — Session #{activeSession?.sessionNumber}
                        </DialogTitle>
                        <DialogDescription>
                            Add more context, findings, or follow-up notes. This will be appended to the existing notes and the version will be bumped.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {activeSession?.rawTextNotes && (
                            <div className="bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Existing notes preview:</p>
                                <p className="text-xs text-muted-foreground line-clamp-4 font-mono">
                                    {activeSession.rawTextNotes.slice(0, 300)}
                                    {activeSession.rawTextNotes.length > 300 ? "..." : ""}
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Additional Notes</Label>
                            <Textarea
                                placeholder="Add follow-up findings, clarifications, or additional context..."
                                value={appendNotes}
                                onChange={(e) => setAppendNotes(e.target.value)}
                                rows={8}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAppendNotes} disabled={saving}>
                            {saving ? "Saving..." : "Append Notes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
