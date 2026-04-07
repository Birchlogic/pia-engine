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
import { DfdHtmlRenderer, type DfdData } from "@/components/dfd/DfdHtmlRenderer";
import { type KnowledgeGraph, type PrivacyDfd, type RenderPlan } from "@/components/dfd/EditableDfd";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import ListBasedDfdEditor from "@/components/dfd/ListBasedDfdEditor";
import { PipelineStageTracker, type PipelineStatusResponse } from "@/components/pipeline/PipelineStageTracker";


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
    files: SessionFile[];
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

interface SchemaNode {
    id: string;
    type: "EXTERNAL_ENTITY" | "PROCESS" | "DATA_STORE";
    name: string;
    description: string;
    data_elements?: SchemaDataElement[];
    sub_processes?: any[];  // More specific typing can be added later
    integrations?: any[];
    reference_documents?: string[];
    sla?: string;
}

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
    sessionRunLimit: number;
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
    const [matrixOpen, setMatrixOpen] = useState(false);
    const [schemaOpen, setSchemaOpen] = useState(false);
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

    // Data Matrix (populated from Docker pipeline results)
    const [matrixRows, setMatrixRows] = useState<DataMappingRow[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(false);

    // DFD (populated from Docker pipeline results)
    const [dfdData, setDfdData] = useState<DfdData | null>(null);
    const [dfdHtml, setDfdHtml] = useState<string | null>(null);
    const [dfdLoading, setDfdLoading] = useState(true);
    const [dfdJsonString, setDfdJsonString] = useState<string>("");
    const [savingDfd, setSavingDfd] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [previewFullscreen, setPreviewFullscreen] = useState(false);
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [editorSubTab, setEditorSubTab] = useState<string>("editor");
    const [editedNodes, setEditedNodes] = useState<any[]>([]);
    const [editedEdges, setEditedEdges] = useState<any[]>([]);
    const [editedLevels, setEditedLevels] = useState<string[][]>([]);

    // Upload more files to existing session
    const [uploadingMoreFiles, setUploadingMoreFiles] = useState<string | null>(null);
    const addFilesInputRef = useRef<HTMLInputElement>(null);

    // Refs for export
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // 3-JSON DFD structures from pipeline
    const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
    const [privacyDfd, setPrivacyDfd] = useState<PrivacyDfd | null>(null);
    const [renderPlan, setRenderPlan] = useState<RenderPlan | null>(null);
    const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
    const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("sessions");

    const handleTabChange = (val: string) => {
        setActiveTab(val);
        fetch("/api/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "VIEW_TAB",
                entityType: "Vertical",
                entityId: String(verticalId),
                details: { tab: val, verticalName: vertical?.name || "Unknown Vertical" }
            })
        }).catch(err => console.error("[Tab Tracking] Error:", err));
    };

    // Delete Session
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
    const [deletingSession, setDeletingSession] = useState(false);

    // Unified Pipeline Status
    const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
    const [generatingPipeline, setGeneratingPipeline] = useState(false);

    // Source of Truth (Schema-1)
    const [schemaOne, setSchemaOne] = useState<SchemaOneFull | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(false);

    // Session filter sub-tabs
    const [sessionFilter, setSessionFilter] = useState<"all" | "draft" | "finalized">("all");

    // Rate-limit cooldown timer (60s vanilla timer)
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startCooldown = useCallback(() => {
        setCooldownSeconds(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setCooldownSeconds((prev) => {
                if (prev <= 1) {
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    const isCoolingDown = cooldownSeconds > 0;

    const fetchVertical = useCallback(async () => {
        const res = await fetch(`/api/verticals/${verticalId}`);
        if (res.ok) {
            const data = await res.json();
            setVertical(data.success ? data.data : data);
        }
        setLoading(false);
    }, [verticalId]);

    // Fetch all results from the unified Docker pipeline API
    const fetchPipelineResults = useCallback(async () => {
        setMatrixLoading(true);
        setDfdLoading(true);
        setSchemaLoading(true); // Set schema loading to true here
        try {
            const res = await fetch(`/api/verticals/${verticalId}/pipeline/results`);
            if (res.ok) {
                const data = await res.json();
                if (data?.status === "not_ready") {
                    return;
                }
                // Data mapping rows
                if (data.data_mapping_rows && Array.isArray(data.data_mapping_rows)) {
                    // Filter duplicates based on data category (case insensitive)
                    const uniqueCategories = new Set<string>();
                    const uniqueRows: any[] = [];
                    for (const row of data.data_mapping_rows) {
                        const categoryLower = (row.data_category || "").toLowerCase().trim();
                        if (categoryLower && !uniqueCategories.has(categoryLower)) {
                            uniqueCategories.add(categoryLower);
                            uniqueRows.push(row);
                        }
                    }

                    setMatrixRows(uniqueRows.map((row: any, idx: number) => ({
                        id: row.id || `row-${idx}`,
                        sNo: idx + 1,
                        dataCategory: row.data_category || "",
                        description: row.description || "",
                        purpose: row.purpose || "",
                        dataOwner: row.data_owner || "",
                        storageLocation: row.storage_location || "",
                        dataClassification: row.data_classification || "",
                        retentionPeriod: row.retention_period || "",
                        legalBasis: row.legal_basis || "",
                    })));
                }
                // DFD JSON & HTML
                if (data.dfd_json) {
                    setDfdData(data.dfd_json);
                    setDfdJsonString(JSON.stringify(data.dfd_json, null, 2));
                }
                // 3-JSON DFD structures (knowledge_graph, privacy_dfd, dfd_render_plan)
                if (data.knowledge_graph) setKnowledgeGraph(data.knowledge_graph);
                if (data.privacy_dfd) setPrivacyDfd(data.privacy_dfd);
                if (data.dfd_render_plan) setRenderPlan(data.dfd_render_plan);
                if (data.interactive_html) {
                    setDfdHtml(data.interactive_html);
                }

                // If dfd_json has no nodes, build nodes from actors_json + systems_json
                const dfdHasNodes = data.dfd_json?.nodes && Array.isArray(data.dfd_json.nodes) && data.dfd_json.nodes.length > 0;
                if (!dfdHasNodes) {
                    const builtNodes: any[] = [];
                    if (data.actors_json && Array.isArray(data.actors_json)) {
                        data.actors_json.forEach((a: any) => {
                            builtNodes.push({
                                id: (a.name || "").toLowerCase().replace(/\s+/g, "_"),
                                name: a.name || "",
                                type: a.type || "PERSON",
                                aliases: a.original_names || [],
                                data_elements: [],
                                risks: [],
                                sources: [],
                            });
                        });
                    }
                    if (data.systems_json && Array.isArray(data.systems_json)) {
                        data.systems_json.forEach((s: any) => {
                            builtNodes.push({
                                id: (s.name || "").toLowerCase().replace(/\s+/g, "_"),
                                name: s.name || "",
                                type: s.type || "SYSTEM",
                                aliases: s.original_names || [],
                                data_elements: [],
                                risks: [],
                                sources: [],
                            });
                        });
                    }
                    if (builtNodes.length > 0) {
                        const builtDfd = {
                            nodes: builtNodes,
                            edges: data.flows_json || [],
                        };
                        setDfdData(builtDfd as any);
                        setDfdJsonString(JSON.stringify(builtDfd, null, 2));
                    }
                }

                if (data.schema_one_json) {
                    setSchemaOne(data.schema_one_json);
                }
            }
            // 404 means results not ready — that's fine
        } catch (err) {
            console.error("Error fetching pipeline results:", err);
        }
        setMatrixLoading(false);
        setDfdLoading(false);
        setSchemaLoading(false); // Set schema loading to false here, regardless of success or failure
    }, [verticalId]);

    const fetchPipelineStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/verticals/${verticalId}/pipeline/status`);
            if (res.ok) {
                const data = await res.json();
                const status = data.status || "not_started";
                setPipelineStatus(data);

                if (status === "completed" && data.progress_percent === 100) {
                    fetchPipelineResults();
                } else if (status === "processing" || status === "pending") {
                    setGeneratingPipeline(true);
                }
            }
        } catch (err) {
            console.error("Error fetching stage status:", err);
        }
    }, [verticalId, fetchPipelineResults]);

    useEffect(() => {
        fetchVertical();
        fetchPipelineStatus();
    }, [fetchVertical, fetchPipelineStatus]);

    // Unified pipeline polling
    useEffect(() => {
        if (!generatingPipeline) return;

        let mounted = true;
        const intervalId = setInterval(async () => {
            try {
                const res = await fetch(`/api/verticals/${verticalId}/pipeline/status`);
                if (res.ok && mounted) {
                    const data = await res.json();
                    const status = data.status || "not_started";

                    setPipelineStatus(data);

                    if (status === "completed" && data.progress_percent === 100) {
                        toast.success("Pipeline completed! Fetching results...");
                        setGeneratingPipeline(false);
                        fetchPipelineResults();
                        fetchVertical();
                    } else if (status === "failed") {
                        toast.error(data.error_message || "Pipeline failed.");
                        setGeneratingPipeline(false);
                    }
                }
            } catch (e) {
                // silently ignore network errors during polling
            }
        }, 5000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [generatingPipeline, pipelineStatus, verticalId, fetchPipelineResults, fetchVertical]);

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
                    interviewerNames: [],
                    intervieweeNames: newForm.intervieweeNames
                        .split(",")
                        .map((n) => n.trim())
                        .filter(Boolean),
                    intervieweeRoles: newForm.intervieweeRoles
                        .split(",")
                        .map((r) => r.trim())
                        .filter(Boolean),
                    rawTextNotes: newForm.rawTextNotes || undefined,
                    assessmentCriteriaTags: newForm.selectedTags,
                }),
            });

            if (!res.ok) {
                toast.error("Failed to create session");
                setCreating(false);
                return;
            }

            const responseData = await res.json();
            const session = responseData.data || responseData;

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

    const handleRevertToDraft = async (sessionId: string) => {
        const res = await fetch(`/api/sessions/${sessionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "draft" }),
        });
        if (res.ok) {
            toast.success("Session reverted to draft");
            fetchVertical();
        } else {
            toast.error("Failed to revert session to draft");
        }
    };

    const handleAddMoreFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !activeSession) return;

        const validFiles = files.filter((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase();
            return ext === "txt" || ext === "pdf";
        });

        if (validFiles.length === 0) {
            toast.error("Please select valid .txt or .pdf files");
            return;
        }

        setUploadingMoreFiles(activeSession.id);
        const toastId = toast.loading(`Uploading ${validFiles.length} file(s) to Session #${activeSession.sessionNumber}...`);

        try {
            const formData = new FormData();
            validFiles.forEach((file) => formData.append("files", file));

            const res = await fetch(`/api/sessions/${activeSession.id}/files`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                toast.success("Files uploaded successfully", { id: toastId });
                fetchVertical(); // Refresh to show new files
            } else {
                toast.error("Failed to upload files", { id: toastId });
            }
        } catch (error) {
            toast.error("Error uploading files", { id: toastId });
        } finally {
            setUploadingMoreFiles(null);
            if (addFilesInputRef.current) addFilesInputRef.current.value = "";
        }
    };

    const handleSaveDfd = async () => {
        try {
            const parsedNode = JSON.parse(dfdJsonString);
            setSavingDfd(true);
            const res = await fetch(`/api/verticals/${verticalId}/pipeline/results`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dfd_json: parsedNode }),
            });
            if (res.ok) {
                toast.success("DFD JSON saved successfully");
                setDfdData(parsedNode);
            } else {
                toast.error("Failed to save DFD JSON");
            }
        } catch (e) {
            toast.error("Invalid JSON format");
        } finally {
            setSavingDfd(false);
        }
    };

    const handleDeleteFile = async (sessionId: string, fileId: string, fileName: string) => {
        if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;
        setDownloadingFiles(prev => new Set(prev).add(fileId + "_del"));
        try {
            const res = await fetch(`/api/sessions/${sessionId}/files/${fileId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("File deleted successfully");
                fetchVertical();
            } else {
                toast.error("Failed to delete file");
            }
        } catch {
            toast.error("Error deleting file");
        } finally {
            setDownloadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileId + "_del");
                return newSet;
            });
        }
    };

    const confirmDeleteSession = async () => {
        if (!sessionToDelete) return;

        setDeletingSession(true);
        try {
            // (DFD records are removed automatically if tied to the session in the backend pipeline)

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
                setDeletingSession(false);
            } else {
                const data = await res.json();
                let errorMsg = "Failed to delete session";
                if (typeof data.error === "string") {
                    errorMsg = data.error;
                } else if (data.error && typeof data.error === "object") {
                    errorMsg = "Validation error: " + JSON.stringify(data.error);
                }
                toast.error(errorMsg);
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            toast.error("An error occurred while deleting the session");
            setDeletingSession(false);
        }
    };



    const handleGenerateMatrix = async () => {
        if (isCoolingDown) {
            toast.warning(`Please wait ${cooldownSeconds}s before generating again`);
            return;
        }

        setPipelineStatus({ status: "processing", progress_percent: 0, current_stage: "starting", stages: [], session_id: verticalId } as any);
        const toastId = toast.loading("Preparing to generate new Data Matrix...", { id: "matrix-gen" });
        try {
            // First clear out the previous matrices
            await fetch(`/api/verticals/${verticalId}/pipeline`, {
                method: "DELETE"
            });

            toast.loading("Initiating unified pipeline in background...", { id: toastId });

            const payload = {
                use_rlm: false,
                aggressive_processing: true
            };
            const res = await fetch(`/api/verticals/${verticalId}/pipeline/initiate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Processing started! We're continuously monitoring the status and will update you automatically.", { id: toastId, duration: 5000 });
                setGeneratingPipeline(true);
                startCooldown();
            } else {
                let errorMsg = "Failed to start pipeline";
                if (typeof data.error === "string") {
                    errorMsg = data.error;
                } else if (data.error && typeof data.error === "object") {
                    errorMsg = "Validation error: " + JSON.stringify(data.error);
                } else if (data.detail && typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (data.detail && typeof data.detail === "object") {
                    errorMsg = "Validation error: " + JSON.stringify(data.detail);
                }
                toast.error(errorMsg, { id: toastId });
                setGeneratingPipeline(false);
                setPipelineStatus(null);
            }
        } catch {
            toast.error("Network error — failed to start pipeline", { id: toastId });
            setGeneratingPipeline(false);
            setPipelineStatus(null);
        }
    };

    const logExportActivity = async (format: "PNG" | "PDF") => {
        try {
            await fetch("/api/activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "DFD_EXPORTED",
                    entityType: "Vertical",
                    entityId: verticalId,
                    details: { format, verticalName: vertical?.name || "Unknown Vertical" }
                })
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }
    };

    const handleExportPng = () => {
        if (iframeRef.current) {
            try {
                const doc = iframeRef.current.contentDocument;
                if (!doc) {
                    toast.error("Unable to access diagram document for export");
                    return;
                }

                const svgEl = doc.querySelector("svg");
                const canvasEl = doc.querySelector("canvas") as HTMLCanvasElement | null;

                const fileName = `dfd-${vertical?.name || verticalId}.png`;

                if (canvasEl) {
                    const w = Math.max(1, canvasEl.width || canvasEl.clientWidth || 1);
                    const h = Math.max(1, canvasEl.height || canvasEl.clientHeight || 1);

                    const outCanvas = document.createElement("canvas");
                    outCanvas.width = w;
                    outCanvas.height = h;
                    const ctx = outCanvas.getContext("2d");
                    if (!ctx) {
                        toast.error("Failed to export PNG");
                        return;
                    }

                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(canvasEl, 0, 0);

                    outCanvas.toBlob((blob) => {
                        if (!blob) {
                            toast.error("Failed to export PNG");
                            return;
                        }
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        logExportActivity("PNG");
                    }, "image/png");
                    return;
                }

                if (!svgEl) {
                    toast.error("No SVG/canvas diagram found to export");
                    return;
                }

                const serializer = new XMLSerializer();
                let svgText = serializer.serializeToString(svgEl);
                if (!svgText.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
                    svgText = svgText.replace("<svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"");
                }

                const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
                const url = URL.createObjectURL(svgBlob);
                const img = new Image();

                img.onload = () => {
                    const rect = svgEl.getBoundingClientRect();
                    const w = Math.max(1, Math.round(rect.width));
                    const h = Math.max(1, Math.round(rect.height));

                    const outCanvas = document.createElement("canvas");
                    outCanvas.width = w;
                    outCanvas.height = h;
                    const ctx = outCanvas.getContext("2d");
                    if (!ctx) {
                        URL.revokeObjectURL(url);
                        toast.error("Failed to export PNG");
                        return;
                    }
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);

                    outCanvas.toBlob((blob) => {
                        URL.revokeObjectURL(url);
                        if (!blob) {
                            toast.error("Failed to export PNG");
                            return;
                        }
                        const outUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = outUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(outUrl);
                        logExportActivity("PNG");
                    }, "image/png");
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    toast.error("Failed to render SVG for export");
                };

                img.src = url;
            } catch {
                toast.error("Failed to export PNG from embedded diagram");
            }
        } else {
            toast.error("No DFD available to export");
        }
    };

    // Fallback: capture the whole DFD Viewer tab with html2canvas
    const handleExportPngFallback = async () => {
        const container = document.querySelector('[data-tab-content="dfd"]') as HTMLElement;
        if (!container) {
            toast.error("DFD Viewer tab not found");
            return;
        }
        try {
            const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 2 });
            canvas.toBlob((blob) => {
                if (!blob) {
                    toast.error("Failed to export PNG");
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `dfd-${vertical?.name || verticalId}-tab.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Exported DFD Viewer tab as PNG");
                logExportActivity("PNG");
            }, "image/png");
        } catch (e) {
            console.error("html2canvas error:", e);
            toast.error("Failed to capture tab for PNG export");
        }
    };

    const handleExportPdf = () => {
        if (iframeRef.current) {
            try {
                const doc = iframeRef.current.contentDocument;
                if (!doc) {
                    toast.error("Unable to access diagram document for export");
                    return;
                }

                const svgEl = doc.querySelector("svg");
                const canvasEl = doc.querySelector("canvas") as HTMLCanvasElement | null;

                let bodyHtml = "";
                if (canvasEl) {
                    const w = Math.max(1, canvasEl.width || canvasEl.clientWidth || 1);
                    const h = Math.max(1, canvasEl.height || canvasEl.clientHeight || 1);

                    const outCanvas = document.createElement("canvas");
                    outCanvas.width = w;
                    outCanvas.height = h;
                    const ctx = outCanvas.getContext("2d");
                    if (!ctx) {
                        toast.error("PDF export failed");
                        return;
                    }
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(canvasEl, 0, 0);

                    bodyHtml = `<img src='${outCanvas.toDataURL("image/png")}' style='max-width:100%;height:auto;' />`;
                } else if (svgEl) {
                    bodyHtml = svgEl.outerHTML;
                } else {
                    toast.error("No SVG/canvas diagram found to export");
                    return;
                }

                const printFrame = document.createElement("iframe");
                printFrame.style.position = "fixed";
                printFrame.style.right = "0";
                printFrame.style.bottom = "0";
                printFrame.style.width = "0";
                printFrame.style.height = "0";
                printFrame.style.border = "0";

                const title = `Data Flow Diagram - ${vertical?.name || verticalId}`;
                printFrame.srcdoc = `
                  <html>
                    <head>
                      <title>${title}</title>
                      <style>
                        body { margin: 0; padding: 12mm; background: white; }
                        svg { max-width: 100%; height: auto; }
                        @page { margin: 12mm; }
                      </style>
                    </head>
                    <body>
                      ${bodyHtml}
                      <script>
                        window.onload = function () {
                          setTimeout(function () {
                            window.focus();
                            window.print();
                          }, 50);
                        };
                      </script>
                    </body>
                  </html>
                `;

                document.body.appendChild(printFrame);

                const cleanup = () => {
                    if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
                };
                const w = printFrame.contentWindow;
                if (w) w.onafterprint = () => cleanup();
                setTimeout(cleanup, 10_000);
                logExportActivity("PDF");
            } catch {
                toast.error("PDF export failed — browser blocked printing from the embedded diagram.");
            }
        } else {
            toast.error("No DFD available to export");
        }
    };

    // Fallback: capture the whole DFD Viewer tab and print it via hidden iframe
    const handleExportPdfFallback = async () => {
        const container = document.querySelector('[data-tab-content="dfd"]') as HTMLElement;
        if (!container) {
            toast.error("DFD Viewer tab not found");
            return;
        }
        try {
            const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 2 });
            const imgData = canvas.toDataURL("image/png");
            const title = `Data Flow Diagram - ${vertical?.name || verticalId}`;
            const printFrame = document.createElement("iframe");
            printFrame.style.position = "fixed";
            printFrame.style.right = "0";
            printFrame.style.bottom = "0";
            printFrame.style.width = "0";
            printFrame.style.height = "0";
            printFrame.style.border = "0";
            printFrame.srcdoc = `
              <html>
                <head>
                  <title>${title}</title>
                  <style>
                    body { margin: 0; padding: 12mm; background: white; }
                    img { max-width: 100%; height: auto; }
                    @page { margin: 12mm; }
                  </style>
                </head>
                <body>
                  <img src="${imgData}" />
                  <script>
                    window.onload = function () {
                      setTimeout(function () {
                        window.focus();
                        window.print();
                      }, 50);
                    };
                  </script>
                </body>
              </html>
            `;
            document.body.appendChild(printFrame);
            const cleanup = () => {
                if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
            };
            const w = printFrame.contentWindow;
            if (w) w.onafterprint = () => cleanup();
            setTimeout(cleanup, 10_000);
            toast.success("Exported DFD Viewer tab as PDF");
            logExportActivity("PDF");
        } catch (e) {
            console.error("html2canvas PDF error:", e);
            toast.error("Failed to capture tab for PDF export");
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

    const finalizedSessions = (vertical.sessions || []).filter((s) => s.status === "finalized");
    const draftSessions = (vertical.sessions || []).filter((s) => s.status === "draft");
    const hasFinalizedSessions = finalizedSessions.length > 0;
    const hasDataMatrix = matrixRows.length > 0;
    const totalFiles = (vertical.sessions || []).reduce((sum, s) => sum + (s._count?.files || 0), 0);
    const allTags = new Set((vertical.sessions || []).flatMap((s) => s.assessmentCriteriaTags));
    const criteriaCoverage = Math.round((allTags.size / allCriteria.length) * 100);

    const filteredSessions =
        sessionFilter === "all"
            ? (vertical.sessions || [])
            : (vertical.sessions || []).filter((s) => s.status === sessionFilter);

    return (
        <div className="space-y-6 min-w-0 overflow-hidden">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Link href="/dashboard/projects" className="hover:text-foreground transition-colors">
                    Projects
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
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {/* <span>Total Sessions: {(vertical.sessions || []).length}</span> */}
                        {vertical.headName && (
                            <>
                                <span>•</span>
                                <span>
                                    Head: {vertical.headName}
                                    {vertical.headRole ? ` (${vertical.headRole})` : ""}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sessions">Sessions ({(vertical.sessions || []).length})</TabsTrigger>
                    <TabsTrigger value="matrix">Data Matrix</TabsTrigger>

                    <TabsTrigger value="dfd">DFD Viewer</TabsTrigger>
                    <TabsTrigger value="dfd-editor">DFD Editor</TabsTrigger>

                </TabsList>

                {/* ────────────── Sessions Tab ────────────── */}
                <TabsContent value="sessions" className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-5 gap-3">
                        <Card className="py-3">
                            <CardContent className="px-4 py-0">
                                <p className="text-xs text-muted-foreground">Total Sessions</p>
                                <p className="text-2xl font-bold">{(vertical.sessions || []).length}</p>
                            </CardContent>
                        </Card>
                        <Card className="py-3">
                            <CardContent className="px-4 py-0">
                                <p className="text-xs text-muted-foreground">Finalized</p>
                                <p className="text-2xl font-bold text-green-500">{finalizedSessions.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="py-3">
                            <CardContent className="px-4 py-0">
                                <p className="text-xs text-muted-foreground">Drafts</p>
                                <p className="text-2xl font-bold text-yellow-500">{draftSessions.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="py-3">
                            <CardContent className="px-4 py-0">
                                <p className="text-xs text-muted-foreground">Files Uploaded</p>
                                <p className="text-2xl font-bold">{totalFiles}</p>
                            </CardContent>
                        </Card>
                        <Card className="py-3">
                            <CardContent className="px-4 py-0">
                                <p className="text-xs text-muted-foreground">Criteria Coverage</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold">{criteriaCoverage}%</p>
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${criteriaCoverage >= 80 ? "bg-green-500" : criteriaCoverage >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                            style={{ width: `${criteriaCoverage}%` }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Cooldown Banner */}
                    {isCoolingDown && (
                        <Card className="border-amber-500/30 bg-amber-500/5">
                            <CardContent className="py-2 px-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold text-amber-500 tabular-nums">{cooldownSeconds}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    AI generation cooldown — please wait {cooldownSeconds}s before triggering another generation.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Pipeline Status Tracking (Persistent) */}
                    {pipelineStatus && pipelineStatus.status !== "not_started" && (
                        <div className="mb-6">
                            <PipelineStageTracker data={pipelineStatus} />
                        </div>
                    )}

                    {/* Filter Sub-tabs + Actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                            {(["all", "finalized", "draft"] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setSessionFilter(filter)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sessionFilter === filter
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {filter === "all" ? `All (${(vertical.sessions || []).length})` :
                                        filter === "finalized" ? `Finalized (${finalizedSessions.length})` :
                                            `Drafts (${draftSessions.length})`}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Generate Data Matrix Button */}
                            {hasFinalizedSessions && (
                                <Button
                                    onClick={handleGenerateMatrix}
                                    disabled={generatingPipeline || isCoolingDown}
                                >
                                    {generatingPipeline ? "Generating..." : isCoolingDown ? `Wait ${cooldownSeconds}s` : "Generate Data Matrix"}
                                </Button>
                            )}

                            {/* Hide New Session if one already exists */}
                            {(vertical.sessions || []).length === 0 && (
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
                            )}
                        </div>
                    </div>

                    {/* Sessions list */}
                    {
                        (vertical.sessions || []).length === 0 ? (
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
                        ) : filteredSessions.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-8">
                                    <p className="text-muted-foreground text-sm">
                                        No {sessionFilter} sessions found.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {filteredSessions.map((session) => (
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
                                                                setDeletingSession(false);
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
                                                            title="Upload more documents"
                                                            disabled={!!uploadingMoreFiles}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveSession(session);
                                                                addFilesInputRef.current?.click();
                                                            }}
                                                        >
                                                            {uploadingMoreFiles === session.id ? (
                                                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25" /><path d="M21 12a9 9 0 00-9-9" /></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                    <polyline points="17 8 12 3 7 8" />
                                                                    <line x1="12" x2="12" y1="3" y2="15" />
                                                                </svg>
                                                            )}
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
                                                        {session.status === "finalized" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-amber-500"
                                                                title="Revert to draft"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRevertToDraft(session.id);
                                                                }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                                    <path d="M9 14 4 9l5-5" />
                                                                    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
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

                                                    {/* Files Section */}
                                                    {session.files && session.files.length > 0 && (
                                                        <div className="mt-4">
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">Uploaded Files</p>
                                                            <div className="space-y-2">
                                                                {session.files.map((file) => (
                                                                    <div key={file.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                                                                                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-medium">{file.fileName}</p>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {(Number(file.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                disabled={downloadingFiles.has(file.id)}
                                                                                onClick={async () => {
                                                                                    setDownloadingFiles(prev => new Set(prev).add(file.id));
                                                                                    try {
                                                                                        const response = await fetch(`/api/sessions/${session.id}/files/${file.id}`);
                                                                                        const data = await response.json();
                                                                                        if (response.ok) {
                                                                                            // Fetch the file from the signed URL
                                                                                            const fileResponse = await fetch(data.downloadUrl);
                                                                                            if (fileResponse.ok) {
                                                                                                const blob = await fileResponse.blob();
                                                                                                const url = window.URL.createObjectURL(blob);
                                                                                                const a = document.createElement('a');
                                                                                                a.href = url;
                                                                                                a.download = file.fileName;
                                                                                                document.body.appendChild(a);
                                                                                                a.click();
                                                                                                document.body.removeChild(a);
                                                                                                window.URL.revokeObjectURL(url);
                                                                                                toast.success(`Downloaded ${file.fileName}`);
                                                                                            } else {
                                                                                                toast.error('Failed to download file');
                                                                                            }
                                                                                        } else {
                                                                                            toast.error(data.error || 'Failed to get download URL');
                                                                                        }
                                                                                    } catch {
                                                                                        toast.error('Failed to download file');
                                                                                    } finally {
                                                                                        setDownloadingFiles(prev => {
                                                                                            const newSet = new Set(prev);
                                                                                            newSet.delete(file.id);
                                                                                            return newSet;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {downloadingFiles.has(file.id) ? (
                                                                                    <>
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-1 animate-spin">
                                                                                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                            <path d="M9 12l2 2 4-4" />
                                                                                        </svg>
                                                                                        Downloading...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-1">
                                                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                                            <polyline points="7 10 12 15 17 10" />
                                                                                            <line x1="12" x2="12" y1="15" y2="3" />
                                                                                        </svg>
                                                                                        Download
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                                                title="Delete File"
                                                                                disabled={downloadingFiles.has(file.id + "_del")}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteFile(session.id, file.id, file.fileName);
                                                                                }}
                                                                            >
                                                                                {downloadingFiles.has(file.id + "_del") ? (
                                                                                    <svg className="w-4 h-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path d="M9 12l2 2 4-4" /></svg>
                                                                                ) : (
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </CollapsibleContent>
                                        </Card>
                                    </Collapsible>
                                ))}

                            </div>
                        )
                    }
                </TabsContent>

                {/* ────────────── Data Matrix & Schema Tab ────────────── */}
                <TabsContent value="matrix" className="space-y-8 min-w-0">
                    {matrixLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                            <>


                                {/* ────────────── Data Mapping & Inventory Rows ────────────── */}
                                {matrixRows.length > 0 ? (
                                    <Collapsible
                                        open={matrixOpen}
                                        onOpenChange={setMatrixOpen}
                                        className="bg-card text-card-foreground shadow-sm rounded-xl border border-border mt-4"
                                    >
                                        <div className="flex flex-col space-y-1.5 p-6 pb-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-muted/50 rounded-md transition-transform duration-200">
                                                            {matrixOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            <span className="sr-only">Toggle</span>
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                    <div>
                                                        <h3 className="text-xl font-semibold leading-none tracking-tight">1. Data Mapping & Inventory Rows</h3>
                                                        <p className="text-sm text-muted-foreground mt-1.5">{matrixRows.length} data categories identified</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        onClick={handleGenerateMatrix}
                                                        disabled={generatingPipeline}
                                                        size="sm"
                                                    >
                                                        {generatingPipeline ? "Generating..." : "Generate Matrix & Schema"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <CollapsibleContent>
                                            <div className="p-6 pt-0 w-full overflow-hidden">
                                                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 pb-4">
                                                    {matrixRows.map((row, idx) => (
                                                        <Card key={row.id} className="flex flex-col overflow-hidden transition-all hover:shadow-md border-border/50">
                                                            <div className="bg-muted/30 px-5 py-3 border-b flex items-start justify-between gap-4">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                                                                        {row.sNo}
                                                                    </div>
                                                                    <h4 className="font-semibold text-base line-clamp-1" title={row.dataCategory}>
                                                                        {row.dataCategory}
                                                                    </h4>
                                                                </div>
                                                                <Badge variant={
                                                                    row.dataClassification.toLowerCase().includes("pii") || row.dataClassification.toLowerCase().includes("sensitive")
                                                                        ? "destructive"
                                                                        : row.dataClassification.toLowerCase().includes("confidential")
                                                                            ? "default"
                                                                            : "secondary"
                                                                } className="shrink-0">
                                                                    {row.dataClassification}
                                                                </Badge>
                                                            </div>
                                                            <CardContent className="p-5 flex-1 flex flex-col gap-4">
                                                                <div className="space-y-1.5">
                                                                    <span className="text-xs font-semibold uppercase text-muted-foreground">Description</span>
                                                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                                                        {row.description}
                                                                    </p>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <span className="text-xs font-semibold uppercase text-muted-foreground">Purpose</span>
                                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                                        {row.purpose}
                                                                    </p>
                                                                </div>

                                                                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                                                                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md text-xs text-secondary-foreground" title="Data Owner">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                                        <span className="truncate max-w-[120px]">{row.dataOwner}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md text-xs text-secondary-foreground" title="Storage Location">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-70"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                                                                        <span className="truncate max-w-[120px]">{row.storageLocation}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md text-xs text-secondary-foreground" title="Retention Period">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-70"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                                        <span>{row.retentionPeriod}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md text-xs text-secondary-foreground" title="Legal Basis">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-70"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                                        <span className="truncate max-w-[140px]">{row.legalBasis}</span>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
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
                            </>
                        )
                    }

                    {/* ────────────── Schema Content ────────────── */}
                    <Collapsible
                        open={schemaOpen}
                        onOpenChange={setSchemaOpen}
                        className="bg-card text-card-foreground shadow-sm rounded-xl border border-border mt-8"
                    >
                        <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b">
                            <div className="flex items-center gap-3">
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-muted/50 rounded-md transition-transform duration-200">
                                        {schemaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        <span className="sr-only">Toggle schema</span>
                                    </Button>
                                </CollapsibleTrigger>
                                <h2 className="text-xl font-bold">2. Schema-1 Data Model Graph</h2>
                            </div>
                        </div>
                        <CollapsibleContent>
                            <div className="p-6">
                                {schemaLoading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                    </div>
                                ) : !schemaOne || !schemaOne.nodes || schemaOne.nodes.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-16">
                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-muted-foreground">
                                                    <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold mb-1">No Schema-1 Nodes Yet</h3>
                                            <p className="text-muted-foreground text-sm mb-4 text-center max-w-sm">
                                                Generate the Data Matrix first. Schema-1 is created during that process.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (() => {
                                    const entities = schemaOne.nodes.filter(n => n.type === "EXTERNAL_ENTITY");
                                    const processes = schemaOne.nodes.filter(n => n.type === "PROCESS");
                                    const stores = schemaOne.nodes.filter(n => n.type === "DATA_STORE");

                                    const nodeLabel = (id: string) => {
                                        const node = schemaOne.nodes.find(n => n.id === id);
                                        return node?.name || id;
                                    };

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
                                            <Card key={node.id} className={`min-w-0 overflow-hidden ${hasSensitive ? "border-orange-200 dark:border-orange-800" : ""}`}>
                                                <CardHeader className="pb-3 min-w-0">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-xl mt-0.5">{typeIcon(node.type)}</span>
                                                            <div>
                                                                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                                                    {node.name}
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
                                                    <Badge variant="secondary">{(schemaOne.flows || []).length}</Badge>
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
                                            {(schemaOne.flows || []).length > 0 && (
                                                <div>
                                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                        🔀 Data Flows ({(schemaOne.flows || []).length})
                                                    </h3>
                                                    <Card className="overflow-hidden min-w-0">
                                                        <div className="rounded-lg overflow-x-auto">
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
                                                                    {(schemaOne.flows || []).map((flow: any, i: number) => (
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
                                                                                        {flow.data_elements.map((de: string, j: number) => (
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
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </TabsContent>

                <TabsContent value="dfd" className="space-y-4 min-w-0 overflow-x-auto" data-tab-content="dfd">
                    {dfdLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : dfdData ? (
                        <div className="w-full relative min-h-[500px] min-w-0 overflow-x-auto">
                            <DfdHtmlRenderer dfd={dfdData} ref={dfdRendererRef} />
                        </div>
                    ) : (
                        <Card className="flex flex-col items-center justify-center p-12 bg-slate-50 border-dashed border-2">
                            <Activity className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-600">No Data Flow Diagram</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
                                A DFD will be automatically generated once the Schema mapping completes.
                            </p>
                        </Card>
                    )}
                </TabsContent>

                {/* ────────────── DFD Editor Tab ────────────── */}
                <TabsContent value="dfd-editor" className="space-y-0">
                    {dfdLoading || (!dfdData && !knowledgeGraph) ? (
                        <div className="space-y-3">
                            <Skeleton className="h-64 w-full" />
                            <p className="text-sm text-muted-foreground text-center">Loading editor data...</p>
                        </div>
                    ) : (() => {
                        // Prefer knowledgeGraph JSON data, fall back to dfdData
                        const kgNodes = knowledgeGraph?.nodes || [];
                        const kgEdges = knowledgeGraph?.edges || [];
                        const dfdNodes = (dfdData as any)?.nodes || [];
                        const dfdEdges = (dfdData as any)?.edges || [];
                        const useKg = kgNodes.length > 0;
                        const editorNodes = useKg
                            ? kgNodes.map((n: any) => ({
                                id: n.id || n.node_id || "",
                                name: n.name || "",
                                type: n.type || "unknown",
                                aliases: n.aliases || [],
                                data_elements: n.data_elements || [],
                                risks: n.risks || [],
                                sources: n.sources || [],
                            }))
                            : dfdNodes.map((n: any) => ({
                                id: n.id || n.node_id || "",
                                name: n.name || "",
                                type: n.type || "unknown",
                                aliases: n.aliases || [],
                                data_elements: n.data_elements || [],
                                risks: n.risks || [],
                                sources: n.sources || [],
                            }));
                        const editorEdges = useKg
                            ? kgEdges.map((e: any) => ({
                                source: e.source || e.source_node || "",
                                target: e.target || e.target_node || "",
                                data_elements: e.data_elements || [],
                                flow_type: e.flow_type || "",
                                channel: e.channel || "",
                                inferred: e.inferred ?? false,
                                sources: e.sources || [],
                            }))
                            : dfdEdges.map((e: any) => ({
                                source: e.source || e.source_node || "",
                                target: e.target || e.target_node || "",
                                data_elements: e.data_elements || [],
                                flow_type: e.flow_type || "",
                                channel: e.channel || "",
                                inferred: e.inferred ?? false,
                                sources: e.sources || [],
                            }));
                        const editorLevels = renderPlan?.levels || (dfdData as any)?.dfd_render_plan?.levels || [];

                        return (
                            <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
                                {/* Sub-tab header */}
                                <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/30">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setEditorSubTab("editor")}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${editorSubTab === "editor"
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                }`}
                                        >
                                            Editor
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditorSubTab("preview");
                                                // Auto-trigger preview when switching to preview tab
                                                const nodes = editedNodes.length > 0 ? editedNodes : editorNodes;
                                                const edges = editedEdges.length > 0 ? editedEdges : editorEdges;
                                                const levels = editedLevels.length > 0 ? editedLevels : editorLevels;
                                                setPreviewing(true);
                                                fetch("/api/dfd/preview", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ nodes, edges, levels, pipeline_docs: {} }),
                                                }).then(res => res.ok ? res.json() : null)
                                                    .then(data => { if (data?.html) setPreviewHtml(data.html); })
                                                    .catch(err => console.error("Preview error:", err))
                                                    .finally(() => setPreviewing(false));
                                            }}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${editorSubTab === "preview"
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                }`}
                                        >
                                            Preview
                                            {previewing && (
                                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editorSubTab === "preview" && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setPreviewFullscreen(!previewFullscreen)}
                                                title={previewFullscreen ? "Exit fullscreen" : "Expand preview"}
                                            >
                                                {previewFullscreen ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /></svg>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Editor sub-tab content — always mounted, hidden when preview is active */}
                                <div className={`p-4 ${editorSubTab !== "editor" ? "hidden" : ""}`}>
                                    <ListBasedDfdEditor
                                        initialNodes={editorNodes}
                                        initialEdges={editorEdges}
                                        initialLevels={editorLevels}
                                        previewing={previewing}
                                        saving={savingDfd}
                                        onChanged={(nodes, edges, levels) => {
                                            setEditedNodes(nodes);
                                            setEditedEdges(edges);
                                            setEditedLevels(levels);
                                        }}
                                        onSave={async (nodes, edges, levels) => {
                                            setSavingDfd(true);
                                            const toastId = toast.loading("Saving DFD & regenerating...");
                                            try {
                                                const res = await fetch("/api/dfd/update_session", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        session_id: verticalId,
                                                        nodes,
                                                        edges,
                                                        levels,
                                                        pipeline_docs: {},
                                                    }),
                                                });
                                                if (res.ok) {
                                                    toast.success("DFD saved & regenerated!", { id: toastId });
                                                    fetchPipelineResults();
                                                } else {
                                                    const err = await res.json();
                                                    toast.error(err.error || "Failed to save DFD", { id: toastId });
                                                }
                                            } catch (e) {
                                                console.error("Save error:", e);
                                                toast.error("Error connecting to server", { id: toastId });
                                            } finally {
                                                setSavingDfd(false);
                                            }
                                        }}
                                    />
                                </div>

                                {/* Preview sub-tab content */}
                                {editorSubTab === "preview" && (
                                    <div className={previewFullscreen
                                        ? "fixed inset-0 z-50 flex flex-col bg-background"
                                        : ""
                                    }>
                                        {previewFullscreen && (
                                            <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                                                <h3 className="text-sm font-medium">DFD Preview</h3>
                                                <div className="flex items-center gap-2">
                                                    {previewing && (
                                                        <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                                                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            Updating...
                                                        </span>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewFullscreen(false)} title="Exit fullscreen">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`min-h-[600px] ${previewFullscreen ? "flex-1" : ""}`}>
                                            {previewing && !previewHtml && !dfdHtml ? (
                                                <div className="flex flex-col items-center justify-center h-full p-12">
                                                    <svg className="w-8 h-8 animate-spin text-muted-foreground/50 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <p className="text-sm text-muted-foreground">Generating preview...</p>
                                                </div>
                                            ) : (previewHtml || dfdHtml) ? (
                                                <iframe
                                                    srcDoc={previewHtml || dfdHtml || ""}
                                                    className={`w-full border-none ${previewFullscreen ? "h-full" : "min-h-[600px] h-[70vh]"}`}
                                                    title="DFD Preview"
                                                    sandbox="allow-scripts allow-same-origin"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                                                    <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                                    <p className="text-sm text-muted-foreground">No preview available yet.</p>
                                                    <p className="text-xs text-muted-foreground/60 mt-1">Make edits in the Editor tab, then switch here to see the updated diagram.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </TabsContent>
            </Tabs >

            {/* Add Notes Dialog */}
            < Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen} >
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            Add Notes — Session #{activeSession?.sessionNumber}
                        </DialogTitle>
                        <DialogDescription>
                            Add more context, findings, or follow-up notes. This will be appended to the existing notes and the version will be bumped.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 overflow-y-auto flex-1">
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
                    <DialogFooter className="border-t pt-4 mt-2">
                        <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAppendNotes} disabled={saving}>
                            {saving ? "Saving..." : "Append Notes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Delete Confirmation Dialog */}
            < Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} >
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
            </Dialog >

            <input
                type="file"
                multiple
                accept=".txt,.pdf"
                className="hidden"
                ref={addFilesInputRef}
                onChange={handleAddMoreFiles}
            />
        </div >
    );
}
