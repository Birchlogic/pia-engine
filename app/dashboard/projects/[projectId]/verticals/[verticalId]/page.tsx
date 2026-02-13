"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

type SessionFile = {
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: string;
    transcriptionStatus: string;
};

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

type DataMappingRow = {
    id: string;
    sNo: number;
    dataCategory: string;
    description: string;
    purpose: string;
    dataOwner: string;
    storageLocation: string;
    dataClassification: string;
    retentionPeriod: string;
    legalBasis: string;
};

type SchemaDataElement = {
    name: string;
    description?: string;
    classification?: string;
    purpose?: string;
    retention_period?: string;
    legal_basis?: string;
    storage_location?: string;
    owner?: string;
};

type SchemaSubProcess = {
    name: string;
    description?: string;
    routing?: string;
};

type SchemaIntegration = {
    system: string;
    type?: string;
    direction?: string;
};

type SchemaNode = {
    id: string;
    type: "EXTERNAL_ENTITY" | "PROCESS" | "DATA_STORE";
    label: string;
    description?: string;
    data_elements?: SchemaDataElement[];
    sub_processes?: SchemaSubProcess[];
    sla?: string;
    integrations?: SchemaIntegration[];
    reference_documents?: string[];
};

type SchemaFlow = {
    id: string;
    source: string;
    target: string;
    label: string;
    data_elements?: string[];
    bi_directional?: boolean;
    transfer_mechanism?: string;
    cross_border?: boolean | null;
};

type SchemaOneFull = {
    meta?: { project_name?: string; vertical_name?: string; generated_at?: string };
    nodes: SchemaNode[];
    flows: SchemaFlow[];
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
    dataMatrix: { id: string } | null;
    _count: { sessions: number; dataMappingRows: number };
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
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    // Data Matrix
    const [matrixRows, setMatrixRows] = useState<DataMappingRow[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [generatingMatrix, setGeneratingMatrix] = useState(false);

    // DFD
    const [mermaidCode, setMermaidCode] = useState<string | null>(null);
    const [dfdLoading, setDfdLoading] = useState(false);
    const [generatingDfd, setGeneratingDfd] = useState(false);
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState("sessions");

    // Delete Session
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
    const [deletingSession, setDeletingSession] = useState(false);

    // Source of Truth (Schema-1)
    const [schemaOne, setSchemaOne] = useState<SchemaOneFull | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(false);


    const fetchVertical = useCallback(async () => {
        const res = await fetch(`/api/verticals/${verticalId}`);
        if (res.ok) setVertical(await res.json());
        setLoading(false);
    }, [verticalId]);

    const fetchMatrixRows = useCallback(async () => {
        setMatrixLoading(true);
        const res = await fetch(`/api/matrix?verticalId=${verticalId}`);
        if (res.ok) {
            const data = await res.json();
            setMatrixRows(data.rows || []);
        }
        setMatrixLoading(false);
    }, [verticalId]);

    const fetchDfd = useCallback(async () => {
        setDfdLoading(true);
        const res = await fetch(`/api/dfd?verticalId=${verticalId}`);
        if (res.ok) {
            const data = await res.json();
            setMermaidCode(data.mermaidCode || null);
        }
        setDfdLoading(false);
    }, [verticalId]);

    const fetchSchemaOne = useCallback(async () => {
        setSchemaLoading(true);
        const res = await fetch(`/api/key-processes?verticalId=${verticalId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.nodes?.length > 0) {
                setSchemaOne(data);
            }
        }
        setSchemaLoading(false);
    }, [verticalId]);

    useEffect(() => {
        fetchVertical();
        fetchMatrixRows();
        fetchDfd();
        fetchSchemaOne();
    }, [fetchVertical, fetchMatrixRows, fetchDfd, fetchSchemaOne]);

    // Render Mermaid diagram when tab becomes visible AND mermaidCode is available
    const [mermaidError, setMermaidError] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab !== "dfd" || !mermaidCode) return;

        // Small delay to ensure the tab content is mounted in the DOM
        const timer = setTimeout(async () => {
            if (!mermaidRef.current) return;

            try {
                setMermaidError(null);
                const mermaid = (await import("mermaid")).default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "default",
                    securityLevel: "loose",
                });
                const renderId = `dfd-${Date.now()}`;
                const { svg } = await mermaid.render(renderId, mermaidCode);
                if (mermaidRef.current) {
                    mermaidRef.current.innerHTML = svg;
                }
            } catch (err) {
                console.error("Mermaid render error:", err);
                setMermaidError(err instanceof Error ? err.message : "Failed to render diagram");
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [activeTab, mermaidCode]);

    const handleCreateSession = async () => {
        if (!newForm.rawTextNotes.trim() && uploadFiles.length === 0) {
            toast.error("Please add interview notes or upload files");
            return;
        }
        setCreating(true);
        try {
            // 1. Create the session
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
                    rawTextNotes: newForm.rawTextNotes || null,
                    assessmentCriteriaTags: newForm.selectedTags,
                }),
            });

            if (!res.ok) {
                toast.error("Failed to create session");
                setCreating(false);
                return;
            }

            const session = await res.json();

            // 2. Upload files if any
            if (uploadFiles.length > 0) {
                const formData = new FormData();
                uploadFiles.forEach((file) => formData.append("files", file));

                const uploadRes = await fetch(`/api/sessions/${session.id}/files`, {
                    method: "POST",
                    body: formData,
                });

                if (!uploadRes.ok) {
                    toast.warning("Session created but file upload failed");
                } else {
                    const uploadData = await uploadRes.json();
                    toast.success(`Session created with ${uploadData.files.length} file(s) uploaded`);
                }
            } else {
                toast.success("Session created");
            }

            setNewDialogOpen(false);
            setNewForm({ intervieweeNames: "", intervieweeRoles: "", rawTextNotes: "", selectedTags: [] });
            setUploadFiles([]);
            fetchVertical();
        } catch {
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

    const confirmDeleteSession = async () => {
        if (!sessionToDelete) return;

        setDeletingSession(true);
        try {
            const res = await fetch(`/api/sessions/${sessionToDelete}`, {
                method: "DELETE",
            });

            if (res.ok) {
                // Remove from local state
                if (vertical) {
                    setVertical({
                        ...vertical,
                        sessions: vertical.sessions.filter(s => s.id !== sessionToDelete)
                    });
                }
                toast.success("Session deleted successfully");
                setDeleteDialogOpen(false);
                setSessionToDelete(null);
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to delete session");
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            toast.error("An error occurred while deleting the session");
        } finally {
            setDeletingSession(false);
        }
    };

    const handleGenerateMatrix = async () => {
        setGeneratingMatrix(true);
        try {
            const res = await fetch("/api/ai/generate-matrix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ verticalId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Data Matrix generated!");
                fetchMatrixRows();
                fetchSchemaOne();
                fetchVertical();
            } else {
                toast.error(data.error || "Failed to generate Data Matrix");
            }
        } catch {
            toast.error("Failed to generate Data Matrix");
        }
        setGeneratingMatrix(false);
    };

    const handleGenerateDfd = async () => {
        setGeneratingDfd(true);
        try {
            const res = await fetch("/api/ai/generate-dfd", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ verticalId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Data Flow Diagram generated!");
                setMermaidCode(data.mermaidCode);
                fetchVertical();
            } else {
                toast.error(data.error || "Failed to generate DFD");
            }
        } catch {
            toast.error("Failed to generate DFD");
        }
        setGeneratingDfd(false);
    };

    const toggleExpanded = (id: string) => {
        setExpandedSessions((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase();
            return ext === "txt" || ext === "pdf";
        });
        if (validFiles.length !== files.length) {
            toast.warning("Only .txt and .pdf files are supported");
        }
        setUploadFiles((prev) => [...prev, ...validFiles]);
    };

    const removeFile = (index: number) => {
        setUploadFiles((prev) => prev.filter((_, i) => i !== index));
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
    const hasFinalizedSessions = finalizedSessions.length > 0;
    const hasDataMatrix = matrixRows.length > 0;

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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sessions">Sessions ({vertical.sessions.length})</TabsTrigger>
                    <TabsTrigger value="matrix">Data Matrix</TabsTrigger>
                    <TabsTrigger value="schema">Source of Truth</TabsTrigger>
                    <TabsTrigger value="dfd">DFD</TabsTrigger>

                </TabsList>

                {/* ────────────── Sessions Tab ────────────── */}
                <TabsContent value="sessions" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {finalizedSessions.length} finalized, {vertical.sessions.length - finalizedSessions.length} drafts
                        </p>

                        <div className="flex items-center gap-2">
                            {/* Generate Data Matrix Button */}
                            {hasFinalizedSessions && (
                                <Button
                                    onClick={handleGenerateMatrix}
                                    disabled={generatingMatrix}
                                >
                                    {generatingMatrix ? "Generating..." : "Generate Data Matrix"}
                                </Button>
                            )}

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

                                        {/* File Upload */}
                                        <div className="space-y-2">
                                            <Label>Upload Documents (.txt, .pdf)</Label>
                                            <div
                                                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const files = Array.from(e.dataTransfer.files);
                                                    const validFiles = files.filter((f) => {
                                                        const ext = f.name.split(".").pop()?.toLowerCase();
                                                        return ext === "txt" || ext === "pdf";
                                                    });
                                                    if (validFiles.length !== files.length) {
                                                        toast.warning("Only .txt and .pdf files are supported");
                                                    }
                                                    setUploadFiles((prev) => [...prev, ...validFiles]);
                                                }}
                                            >
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    multiple
                                                    accept=".txt,.pdf"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                />
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mx-auto mb-2 text-muted-foreground">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="17 8 12 3 7 8" />
                                                    <line x1="12" x2="12" y1="3" y2="15" />
                                                </svg>
                                                <p className="text-sm text-muted-foreground">
                                                    Click or drag files here to upload
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Supported: .txt, .pdf
                                                </p>
                                            </div>
                                            {/* File list */}
                                            {uploadFiles.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {uploadFiles.map((file, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground">
                                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                                    <polyline points="14 2 14 8 20 8" />
                                                                </svg>
                                                                <span className="truncate max-w-[300px]">{file.name}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    ({(file.size / 1024).toFixed(1)} KB)
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                                                    <path d="M18 6 6 18" />
                                                                    <path d="m6 6 12 12" />
                                                                </svg>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Interview Notes</Label>
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
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSessionToDelete(session.id);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                            <path d="M3 6h18" />
                                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            <line x1="10" x2="10" y1="11" y2="17" />
                                                            <line x1="14" x2="14" y1="11" y2="17" />
                                                        </svg>
                                                        <span className="sr-only">Delete session</span>
                                                    </Button>
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
                </TabsContent>

                {/* ────────────── Data Matrix Tab ────────────── */}
                <TabsContent value="matrix" className="space-y-4">
                    {matrixLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : matrixRows.length > 0 ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Data Mapping & Inventory</CardTitle>
                                        <CardDescription>{matrixRows.length} data categories identified</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateMatrix}
                                        disabled={generatingMatrix}
                                    >
                                        {generatingMatrix ? "Regenerating..." : "Regenerate"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50">
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">S.No</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Data Category</th>
                                                <th className="px-4 py-3 text-left font-semibold">Description</th>
                                                <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Data Owner</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Storage Location</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Data Classification</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Retention Period</th>
                                                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Legal Basis</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixRows.map((row, idx) => (
                                                <tr key={row.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                                    <td className="px-4 py-3 font-medium">{row.sNo}</td>
                                                    <td className="px-4 py-3 font-medium whitespace-nowrap">{row.dataCategory}</td>
                                                    <td className="px-4 py-3 max-w-[200px]">{row.description}</td>
                                                    <td className="px-4 py-3 max-w-[180px]">{row.purpose}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{row.dataOwner}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{row.storageLocation}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={
                                                            row.dataClassification.toLowerCase().includes("pii") || row.dataClassification.toLowerCase().includes("sensitive")
                                                                ? "destructive"
                                                                : row.dataClassification.toLowerCase().includes("confidential")
                                                                    ? "default"
                                                                    : "secondary"
                                                        }>
                                                            {row.dataClassification}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{row.retentionPeriod}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{row.legalBasis}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
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
                                <h3 className="text-lg font-semibold mb-1">No Data Matrix Yet</h3>
                                <p className="text-muted-foreground text-sm mb-4 text-center max-w-sm">
                                    {hasFinalizedSessions
                                        ? "Click \"Generate Data Matrix\" in the Sessions tab to create the data mapping."
                                        : "Finalize at least one session, then generate the Data Matrix from the Sessions tab."}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ────────────── DFD Tab ────────────── */}

                {/* ────────────── Source of Truth Tab ────────────── */}
                <TabsContent value="schema" className="space-y-6">
                    {schemaLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-muted-foreground">Loading Schema-1 data...</p>
                        </div>
                    ) : !schemaOne ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-muted-foreground">
                                        <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No Schema-1 Data Yet</h3>
                                <p className="text-muted-foreground text-sm mb-4 text-center max-w-sm">
                                    Generate the Data Matrix first. Schema-1 is created during that process.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (() => {
                        const entities = schemaOne.nodes.filter(n => n.type === "EXTERNAL_ENTITY");
                        const processes = schemaOne.nodes.filter(n => n.type === "PROCESS");
                        const stores = schemaOne.nodes.filter(n => n.type === "DATA_STORE");

                        const nodeLabel = (id: string) => schemaOne.nodes.find(n => n.id === id)?.label || id;

                        const classificationColor = (c?: string) => {
                            switch (c) {
                                case "Special Category": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
                                case "PII/Sensitive": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
                                case "Confidential": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
                                case "Internal": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
                                case "Public": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
                                default: return "bg-muted text-muted-foreground";
                            }
                        };

                        const typeIcon = (type: string) => {
                            switch (type) {
                                case "EXTERNAL_ENTITY": return "👤";
                                case "PROCESS": return "⚙️";
                                case "DATA_STORE": return "🗄️";
                                default: return "📦";
                            }
                        };

                        const renderNodeCard = (node: SchemaNode) => {
                            const des = node.data_elements || [];
                            const hasSensitive = des.some(
                                de => de.classification === "PII/Sensitive" || de.classification === "Special Category"
                            );
                            return (
                                <Card key={node.id} className={hasSensitive ? "border-orange-200 dark:border-orange-800" : ""}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <span className="text-xl mt-0.5">{typeIcon(node.type)}</span>
                                                <div>
                                                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                                        {node.label}
                                                        <Badge variant="outline" className="text-xs font-normal">
                                                            {node.type.replace(/_/g, " ")}
                                                        </Badge>
                                                        {hasSensitive && (
                                                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                                Contains Sensitive Data
                                                            </span>
                                                        )}
                                                    </CardTitle>
                                                    {node.description && (
                                                        <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                {node.sla && node.sla !== "Not specified" && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md font-medium">
                                                        SLA: {node.sla}
                                                    </span>
                                                )}
                                                <span className="text-xs bg-muted px-2 py-1 rounded-md">
                                                    {des.length} data element{des.length !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-4">
                                        {/* Data Elements Table */}
                                        {des.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Data Elements</p>
                                                <div className="rounded-lg border overflow-hidden">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-muted/50">
                                                                <th className="text-left p-2 font-medium">Name</th>
                                                                <th className="text-left p-2 font-medium">Classification</th>
                                                                <th className="text-left p-2 font-medium hidden md:table-cell">Purpose</th>
                                                                <th className="text-left p-2 font-medium hidden lg:table-cell">Retention</th>
                                                                <th className="text-left p-2 font-medium hidden lg:table-cell">Legal Basis</th>
                                                                <th className="text-left p-2 font-medium hidden xl:table-cell">Owner</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {des.map((de, i) => (
                                                                <tr key={i} className="border-t">
                                                                    <td className="p-2">
                                                                        <span className="font-medium">{de.name}</span>
                                                                        {de.description && (
                                                                            <p className="text-muted-foreground mt-0.5">{de.description}</p>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2">
                                                                        <span className={`px-1.5 py-0.5 rounded text-xs ${classificationColor(de.classification)}`}>
                                                                            {de.classification || "—"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2 hidden md:table-cell text-muted-foreground">{de.purpose || "—"}</td>
                                                                    <td className="p-2 hidden lg:table-cell text-muted-foreground">{de.retention_period || "—"}</td>
                                                                    <td className="p-2 hidden lg:table-cell text-muted-foreground">{de.legal_basis || "—"}</td>
                                                                    <td className="p-2 hidden xl:table-cell text-muted-foreground">{de.owner || "—"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Sub-Processes (PROCESS only) */}
                                        {node.sub_processes && node.sub_processes.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Sub-Processes / Branches</p>
                                                <div className="space-y-2">
                                                    {node.sub_processes.map((sp, i) => (
                                                        <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm">
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <p className="font-medium">{sp.name}</p>
                                                                    {sp.description && (
                                                                        <p className="text-muted-foreground text-xs mt-0.5">{sp.description}</p>
                                                                    )}
                                                                </div>
                                                                {sp.routing && sp.routing !== "Not specified" && (
                                                                    <span className="text-xs bg-background px-2 py-0.5 rounded border flex-shrink-0 ml-2">
                                                                        → {sp.routing}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Integrations (DATA_STORE only) */}
                                        {node.integrations && node.integrations.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Integrations</p>
                                                <div className="space-y-1">
                                                    {node.integrations.map((integ, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-2">
                                                            <span className="font-medium">{integ.system}</span>
                                                            <span className="text-muted-foreground">
                                                                {integ.type && integ.type !== "Not specified" ? integ.type : ""}
                                                                {integ.direction && integ.direction !== "Not specified" ? ` · ${integ.direction}` : ""}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reference Documents */}
                                        {node.reference_documents && node.reference_documents.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Reference Documents</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {node.reference_documents.map((doc, i) => (
                                                        <span key={i} className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded">
                                                            {doc}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        };

                        return (
                            <div className="space-y-6">
                                {/* Summary Header */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Entities:</span>
                                        <Badge variant="secondary">{entities.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Processes:</span>
                                        <Badge variant="secondary">{processes.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Data Stores:</span>
                                        <Badge variant="secondary">{stores.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Flows:</span>
                                        <Badge variant="secondary">{schemaOne.flows.length}</Badge>
                                    </div>
                                    {schemaOne.meta?.generated_at && (
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            Generated: {new Date(schemaOne.meta.generated_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>

                                {/* External Entities */}
                                {entities.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                            👤 External Entities ({entities.length})
                                        </h3>
                                        <div className="grid gap-4">{entities.map(renderNodeCard)}</div>
                                    </div>
                                )}

                                {/* Processes */}
                                {processes.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                            ⚙️ Processes ({processes.length})
                                        </h3>
                                        <div className="grid gap-4">{processes.map(renderNodeCard)}</div>
                                    </div>
                                )}

                                {/* Data Stores */}
                                {stores.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                            🗄️ Data Stores ({stores.length})
                                        </h3>
                                        <div className="grid gap-4">{stores.map(renderNodeCard)}</div>
                                    </div>
                                )}

                                {/* Flows Table */}
                                {schemaOne.flows.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                            🔀 Data Flows ({schemaOne.flows.length})
                                        </h3>
                                        <Card>
                                            <div className="rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-muted/50 border-b">
                                                            <th className="text-left p-3 font-medium">Source</th>
                                                            <th className="text-left p-3 font-medium"></th>
                                                            <th className="text-left p-3 font-medium">Target</th>
                                                            <th className="text-left p-3 font-medium">Description</th>
                                                            <th className="text-left p-3 font-medium hidden md:table-cell">Mechanism</th>
                                                            <th className="text-left p-3 font-medium hidden lg:table-cell">Cross-Border</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {schemaOne.flows.map((flow, i) => (
                                                            <tr key={flow.id || i} className="border-t hover:bg-muted/30 transition-colors">
                                                                <td className="p-3 font-medium">{nodeLabel(flow.source)}</td>
                                                                <td className="p-3 text-muted-foreground">
                                                                    {flow.bi_directional ? "⇄" : "→"}
                                                                </td>
                                                                <td className="p-3 font-medium">{nodeLabel(flow.target)}</td>
                                                                <td className="p-3 text-muted-foreground">
                                                                    {flow.label}
                                                                    {flow.data_elements && flow.data_elements.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {flow.data_elements.map((de, j) => (
                                                                                <span key={j} className="text-xs bg-muted px-1.5 py-0.5 rounded">{de}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 hidden md:table-cell text-muted-foreground">
                                                                    {flow.transfer_mechanism && flow.transfer_mechanism !== "Not specified" ? flow.transfer_mechanism : "—"}
                                                                </td>
                                                                <td className="p-3 hidden lg:table-cell">
                                                                    {flow.cross_border === true && (
                                                                        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">Yes</span>
                                                                    )}
                                                                    {flow.cross_border === false && (
                                                                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">No</span>
                                                                    )}
                                                                    {(flow.cross_border === null || flow.cross_border === undefined) && (
                                                                        <span className="text-xs text-muted-foreground">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </TabsContent>

                <TabsContent value="dfd" className="space-y-4">
                    {dfdLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : mermaidCode ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Data Flow Diagram</CardTitle>
                                        <CardDescription>Mermaid-based DFD generated from Schema-1</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateDfd}
                                        disabled={generatingDfd}
                                    >
                                        {generatingDfd ? "Regenerating..." : "Regenerate"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {mermaidError ? (
                                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                                        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">Failed to render diagram</p>
                                        <p className="text-xs text-red-500 dark:text-red-400/70 mb-3">{mermaidError}</p>
                                        <p className="text-xs text-muted-foreground">Click &quot;Regenerate&quot; to generate fresh Mermaid code.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-lg p-6 overflow-x-auto border" ref={mermaidRef}>
                                        <p className="text-sm text-muted-foreground">Loading diagram...</p>
                                    </div>
                                )}
                                {/* Raw Mermaid Code Toggle */}
                                <details className="mt-4">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                        View raw Mermaid code
                                    </summary>
                                    <pre className="mt-2 bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                                        {mermaidCode}
                                    </pre>
                                </details>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                        <line x1="12" x2="12" y1="22.08" y2="12" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No DFD Yet</h3>
                                <p className="text-muted-foreground text-sm mb-4 text-center max-w-sm">
                                    {hasDataMatrix
                                        ? "Generate the Data Flow Diagram from the Schema-1 data."
                                        : "Generate the Data Matrix first, then you can create the DFD."}
                                </p>
                                {hasDataMatrix && (
                                    <Button
                                        onClick={handleGenerateDfd}
                                        disabled={generatingDfd}
                                    >
                                        {generatingDfd ? "Generating..." : "Generate Data Flow"}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Session</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this session? This action cannot be undone.
                            Files associated with this session will also be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={deletingSession}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteSession}
                            disabled={deletingSession}
                        >
                            {deletingSession ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
