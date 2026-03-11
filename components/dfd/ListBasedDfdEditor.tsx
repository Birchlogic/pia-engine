"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Trash2, Plus, Unlink, Save, Undo2, Redo2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { type PreviewNode, type PreviewEdge } from "@/lib/dfd/transforms";

export interface ListBasedDfdEditorProps {
    initialNodes: PreviewNode[];
    initialEdges: PreviewEdge[];
    initialLevels: string[][];
    onChanged?: (nodes: PreviewNode[], edges: PreviewEdge[], levels: string[][]) => void;
    onSave?: (nodes: PreviewNode[], edges: PreviewEdge[], levels: string[][]) => Promise<void>;
    saving?: boolean;
    previewing?: boolean;
}

const NODE_TYPES = ["actor", "system", "data_store", "process", "unknown"] as const;
const FLOW_TYPES = ["collection", "transfer", "processing", "storage", "dispersal"] as const;

const TYPE_COLORS: Record<string, string> = {
    actor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    system: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    data_store: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    process: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const FLOW_COLORS: Record<string, string> = {
    collection: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    transfer: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    storage: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    dispersal: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

interface HistoryEntry {
    nodes: PreviewNode[];
    edges: PreviewEdge[];
}

interface ConnectionDialogState {
    open: boolean;
    nodeId: string;
    nodeName: string;
    selectedTarget: string;
    step: "direction" | "flow_type";
    direction: "in" | "out" | "";
    flowType: string;
}

interface DeletedNodeEntry {
    node: PreviewNode;
    connectedEdges: PreviewEdge[]; // edges that were removed along with node
}

const MAX_HISTORY = 30;

export default function ListBasedDfdEditor({
    initialNodes,
    initialEdges,
    initialLevels,
    onChanged,
    onSave,
    saving = false,
}: ListBasedDfdEditorProps) {
    const [nodes, setNodes] = useState<PreviewNode[]>(() => JSON.parse(JSON.stringify(initialNodes || [])));
    const [edges, setEdges] = useState<PreviewEdge[]>(() => JSON.parse(JSON.stringify(initialEdges || [])));
    const [levels] = useState<string[][]>(() => JSON.parse(JSON.stringify(initialLevels || [])));
    const [nodeToDelete, setNodeToDelete] = useState<PreviewNode | null>(null);
    const [newTargetForSource, setNewTargetForSource] = useState<Record<string, string>>({});

    // Deleted items for recovery
    const [deletedNodes, setDeletedNodes] = useState<DeletedNodeEntry[]>([]);
    const [deletedEdges, setDeletedEdges] = useState<PreviewEdge[]>([]);
    const [showDeletedItems, setShowDeletedItems] = useState(false);

    // Connection dialog state
    const [connDialog, setConnDialog] = useState<ConnectionDialogState>({
        open: false, nodeId: "", nodeName: "", selectedTarget: "",
        step: "direction", direction: "", flowType: "",
    });

    // Undo/Redo history
    const historyRef = useRef<HistoryEntry[]>([{ nodes: JSON.parse(JSON.stringify(initialNodes || [])), edges: JSON.parse(JSON.stringify(initialEdges || [])) }]);
    const historyIndexRef = useRef(0);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < historyRef.current.length - 1;

    const pushHistory = useCallback((n: PreviewNode[], e: PreviewEdge[]) => {
        const newIndex = historyIndexRef.current + 1;
        historyRef.current = historyRef.current.slice(0, newIndex);
        historyRef.current.push({ nodes: JSON.parse(JSON.stringify(n)), edges: JSON.parse(JSON.stringify(e)) });
        if (historyRef.current.length > MAX_HISTORY) {
            historyRef.current.shift();
        } else {
            historyIndexRef.current = newIndex;
        }
        setHistoryIndex(historyIndexRef.current);
    }, []);

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        const entry = historyRef.current[historyIndexRef.current];
        const n = JSON.parse(JSON.stringify(entry.nodes));
        const e = JSON.parse(JSON.stringify(entry.edges));
        setNodes(n);
        setEdges(e);
        setHistoryIndex(historyIndexRef.current);
        onChanged?.(n, e, levels);
    }, [levels, onChanged]);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        const entry = historyRef.current[historyIndexRef.current];
        const n = JSON.parse(JSON.stringify(entry.nodes));
        const e = JSON.parse(JSON.stringify(entry.edges));
        setNodes(n);
        setEdges(e);
        setHistoryIndex(historyIndexRef.current);
        onChanged?.(n, e, levels);
    }, [levels, onChanged]);

    const applyChange = useCallback(
        (newNodes: PreviewNode[], newEdges: PreviewEdge[]) => {
            setNodes(newNodes);
            setEdges(newEdges);
            pushHistory(newNodes, newEdges);
            onChanged?.(newNodes, newEdges, levels);
        },
        [levels, pushHistory, onChanged]
    );

    // --- Actions ---

    const deleteNode = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) setNodeToDelete(node);
    };

    const confirmDeleteNode = () => {
        if (!nodeToDelete) return;
        const nodeId = nodeToDelete.id;
        const removedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
        const newNodes = nodes.filter((n) => n.id !== nodeId);
        const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

        // Add to deleted items for recovery
        setDeletedNodes((prev) => [...prev, { node: nodeToDelete, connectedEdges: removedEdges }]);

        toast.success(`Deleted node: ${nodeToDelete.name}`);
        setNodeToDelete(null);
        applyChange(newNodes, newEdges);
    };

    const deleteEdge = (source: string, target: string) => {
        const removedEdge = edges.find((e) => e.source === source && e.target === target);
        const newEdges = edges.filter((e) => !(e.source === source && e.target === target));

        // Add to deleted edges for recovery
        if (removedEdge) {
            setDeletedEdges((prev) => [...prev, removedEdge]);
        }

        applyChange(nodes, newEdges);
    };

    // Recovery actions
    const recoverNode = (index: number) => {
        const entry = deletedNodes[index];
        if (!entry) return;

        // Check if node id still exists (avoid duplicates)
        if (nodes.some((n) => n.id === entry.node.id)) {
            toast.error("A node with this ID already exists");
            return;
        }

        const newNodes = [...nodes, entry.node];
        // Also recover connected edges, but only if both source and target exist
        const recoverableEdges = entry.connectedEdges.filter(
            (e) => newNodes.some((n) => n.id === e.source) && newNodes.some((n) => n.id === e.target)
                && !edges.some((ex) => ex.source === e.source && ex.target === e.target)
        );
        const newEdges = [...edges, ...recoverableEdges];

        // Remove from deleted list
        setDeletedNodes((prev) => prev.filter((_, i) => i !== index));
        // Also remove recovered edges from deleted edges list
        const recoveredEdgeKeys = new Set(recoverableEdges.map((e) => `${e.source}-${e.target}`));
        setDeletedEdges((prev) => prev.filter((e) => !recoveredEdgeKeys.has(`${e.source}-${e.target}`)));

        toast.success(`Recovered node: ${entry.node.name} (+ ${recoverableEdges.length} connections)`);
        applyChange(newNodes, newEdges);
    };

    const recoverEdge = (index: number) => {
        const edge = deletedEdges[index];
        if (!edge) return;

        // Check both endpoints exist
        if (!nodes.some((n) => n.id === edge.source) || !nodes.some((n) => n.id === edge.target)) {
            toast.error("Cannot recover: one or both connected nodes have been deleted");
            return;
        }

        // Check for duplicate
        if (edges.some((e) => e.source === edge.source && e.target === edge.target)) {
            toast.error("This connection already exists");
            return;
        }

        const newEdges = [...edges, edge];
        setDeletedEdges((prev) => prev.filter((_, i) => i !== index));

        const srcName = nodes.find((n) => n.id === edge.source)?.name || edge.source;
        const tgtName = nodes.find((n) => n.id === edge.target)?.name || edge.target;
        toast.success(`Recovered connection: ${srcName} → ${tgtName}`);
        applyChange(nodes, newEdges);
    };

    // Open connection dialog when user clicks "+"
    const openConnectionDialog = (nodeId: string) => {
        const target = newTargetForSource[nodeId];
        if (!target) {
            toast.error("Please select a node first");
            return;
        }
        const node = nodes.find((n) => n.id === nodeId);
        setConnDialog({
            open: true,
            nodeId,
            nodeName: node?.name || nodeId,
            selectedTarget: target,
            step: "direction",
            direction: "",
            flowType: "",
        });
    };

    const selectDirection = (dir: "in" | "out") => {
        setConnDialog((prev) => ({ ...prev, direction: dir, step: "flow_type" }));
    };

    const confirmConnection = (flowType: string) => {
        const { nodeId, selectedTarget, direction } = connDialog;
        const source = direction === "in" ? selectedTarget : nodeId;
        const target = direction === "in" ? nodeId : selectedTarget;

        const exists = edges.some((e) => e.source === source && e.target === target);
        if (exists) {
            toast.error("This connection already exists");
            setConnDialog((prev) => ({ ...prev, open: false }));
            return;
        }

        const newEdge: PreviewEdge = {
            source, target, flow_type: flowType,
            data_elements: [], channel: "", inferred: false, sources: [],
        };
        const newEdges = [...edges, newEdge];
        setNewTargetForSource((prev) => ({ ...prev, [nodeId]: "" }));

        const selectedNodeName = nodes.find((n) => n.id === selectedTarget)?.name || selectedTarget;
        const dirLabel = direction === "in" ? `${selectedNodeName} → ${connDialog.nodeName}` : `${connDialog.nodeName} → ${selectedNodeName}`;
        toast.success(`Connection added: ${dirLabel} (${flowType})`);

        setConnDialog((prev) => ({ ...prev, open: false }));
        applyChange(nodes, newEdges);
    };

    const nodeMap = useMemo(() => {
        const map = new Map<string, string>();
        nodes.forEach((n) => map.set(n.id, n.name || n.id));
        return map;
    }, [nodes]);

    const groupedNodes = useMemo(() => {
        const groups: Record<string, PreviewNode[]> = {};
        NODE_TYPES.forEach((t) => (groups[t] = []));
        nodes.forEach((n) => {
            const t = n.type || "unknown";
            if (!groups[t]) groups[t] = [];
            groups[t].push(n);
        });
        return Object.entries(groups).filter(([, arr]) => arr.length > 0);
    }, [nodes]);

    const handleSave = async () => {
        if (onSave) {
            await onSave(nodes, edges, levels);
        }
    };

    const selectedTargetName = nodes.find((n) => n.id === connDialog.selectedTarget)?.name || connDialog.selectedTarget;
    const totalDeletedItems = deletedNodes.length + deletedEdges.length;

    return (
        <div className="space-y-3 w-full">
            {/* Header */}
            <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{nodes.length} Nodes</Badge>
                    <Badge variant="outline" className="text-xs">{edges.length} Edges</Badge>
                    <div className="flex items-center gap-0.5 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={undo} disabled={!canUndo} title="Undo">
                            <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={redo} disabled={!canRedo} title="Redo">
                            <Redo2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    {totalDeletedItems > 0 && (
                        <button
                            onClick={() => setShowDeletedItems(!showDeletedItems)}
                            className="flex items-center gap-1 ml-2 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                        >
                            <Trash2 className="h-3 w-3" />
                            {totalDeletedItems} deleted
                            {showDeletedItems ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                    )}
                </div>
                <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Save className="h-4 w-4 mr-1.5" />
                    {saving ? "Saving..." : "Save & Regenerate"}
                </Button>
            </div>

            {/* Deleted Items Recovery Section */}
            {showDeletedItems && totalDeletedItems > 0 && (
                <div className="rounded-lg border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-900/10 p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                        Deleted Items — Click to recover
                    </h4>

                    {/* Deleted Nodes */}
                    {deletedNodes.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">Nodes</p>
                            <div className="flex flex-wrap gap-1.5">
                                {deletedNodes.map((entry, i) => (
                                    <button
                                        key={`dn-${entry.node.id}-${i}`}
                                        onClick={() => recoverNode(i)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-800/50 bg-white dark:bg-card hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 transition-all text-xs group"
                                        title={`Recover node: ${entry.node.name} (+ ${entry.connectedEdges.length} connections)`}
                                    >
                                        <RotateCcw className="h-3 w-3 text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                                        <span className="font-medium">{entry.node.name}</span>
                                        <Badge variant="outline" className="text-[9px] py-0 capitalize">
                                            {entry.node.type?.replace("_", " ")}
                                        </Badge>
                                        {entry.connectedEdges.length > 0 && (
                                            <span className="text-[9px] text-muted-foreground">
                                                +{entry.connectedEdges.length} conn
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Deleted Edges */}
                    {deletedEdges.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">Connections</p>
                            <div className="flex flex-wrap gap-1.5">
                                {deletedEdges.map((edge, i) => {
                                    const srcName = nodeMap.get(edge.source) || deletedNodes.find((d) => d.node.id === edge.source)?.node.name || edge.source;
                                    const tgtName = nodeMap.get(edge.target) || deletedNodes.find((d) => d.node.id === edge.target)?.node.name || edge.target;
                                    const canRecover = nodes.some((n) => n.id === edge.source) && nodes.some((n) => n.id === edge.target);
                                    return (
                                        <button
                                            key={`de-${edge.source}-${edge.target}-${i}`}
                                            onClick={() => recoverEdge(i)}
                                            disabled={!canRecover}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs group transition-all ${canRecover
                                                ? "border-orange-200 dark:border-orange-800/50 bg-white dark:bg-card hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700"
                                                : "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                                                }`}
                                            title={canRecover ? `Recover: ${srcName} → ${tgtName}` : "Cannot recover: endpoint nodes are deleted"}
                                        >
                                            <RotateCcw className={`h-3 w-3 transition-colors ${canRecover ? "text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400" : "text-muted-foreground/50"}`} />
                                            <span className="truncate max-w-[80px]">{srcName}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="truncate max-w-[80px]">{tgtName}</span>
                                            {edge.flow_type && (
                                                <span className="text-[9px] text-muted-foreground capitalize">({edge.flow_type})</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-border w-full">
                <table className="w-full min-w-max text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                        <tr>
                            <th className="px-3 py-2.5 font-medium">Node</th>
                            <th className="px-3 py-2.5 font-medium">Type</th>
                            <th className="px-3 py-2.5 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="text-green-600 dark:text-green-400">↓</span> Connections In
                                </span>
                            </th>
                            <th className="px-3 py-2.5 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="text-blue-600 dark:text-blue-400">↑</span> Connections Out
                                </span>
                            </th>
                            <th className="px-3 py-2.5 font-medium">Add Connection</th>
                            <th className="px-3 py-2.5 font-medium text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {groupedNodes.flatMap(([type, nodesGroup]) =>
                            nodesGroup.map((node) => {
                                const outgoing = edges.filter((e) => e.source === node.id);
                                const incoming = edges.filter((e) => e.target === node.id);
                                const badgeColor = TYPE_COLORS[type] || TYPE_COLORS["unknown"];

                                return (
                                    <tr key={node.id} className="hover:bg-muted/20 group transition-colors">
                                        <td className="px-3 py-2 align-middle max-w-[160px]" title={node.name}>
                                            <div className="font-medium text-foreground truncate">{node.name}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">{node.id}</div>
                                        </td>
                                        <td className="px-3 py-2 align-middle">
                                            <Badge variant="outline" className={`text-xs font-medium whitespace-nowrap capitalize ${badgeColor}`}>
                                                {type.replace("_", " ")}
                                            </Badge>
                                        </td>
                                        {/* Connections In */}
                                        <td className="px-3 py-2 align-middle">
                                            {incoming.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                    {incoming.map((edge) => {
                                                        const flowColor = FLOW_COLORS[edge.flow_type || ""] || "bg-secondary/50";
                                                        return (
                                                            <Badge
                                                                key={`in-${edge.source}-${edge.target}`}
                                                                variant="secondary"
                                                                className={`text-[11px] font-normal flex items-center gap-1.5 pr-1 pl-2 py-0.5 border transition-colors ${flowColor}`}
                                                            >
                                                                <span className="truncate max-w-[90px]" title={`${nodeMap.get(edge.source) || edge.source} (${edge.flow_type || "transfer"})`}>
                                                                    {nodeMap.get(edge.source) || edge.source}
                                                                </span>
                                                                <span className="text-[9px] font-semibold capitalize opacity-70">{edge.flow_type || ""}</span>
                                                                <button
                                                                    className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive group/btn"
                                                                    onClick={(ev) => { ev.stopPropagation(); deleteEdge(edge.source, node.id); }}
                                                                    title="Remove"
                                                                >
                                                                    <Unlink className="h-3 w-3 text-muted-foreground group-hover/btn:text-destructive transition-colors" />
                                                                </button>
                                                            </Badge>);
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">—</span>
                                            )}
                                        </td>
                                        {/* Connections Out */}
                                        <td className="px-3 py-2 align-middle">
                                            {outgoing.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                    {outgoing.map((edge) => {
                                                        const flowColor = FLOW_COLORS[edge.flow_type || ""] || "bg-secondary/50";
                                                        return (
                                                            <Badge
                                                                key={`out-${edge.source}-${edge.target}`}
                                                                variant="secondary"
                                                                className={`text-[11px] font-normal flex items-center gap-1.5 pr-1 pl-2 py-0.5 border transition-colors ${flowColor}`}
                                                            >
                                                                <span className="truncate max-w-[90px]" title={`${nodeMap.get(edge.target) || edge.target} (${edge.flow_type || "transfer"})`}>
                                                                    {nodeMap.get(edge.target) || edge.target}
                                                                </span>
                                                                <span className="text-[9px] font-semibold capitalize opacity-70">{edge.flow_type || ""}</span>
                                                                <button
                                                                    className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive group/btn"
                                                                    onClick={(ev) => { ev.stopPropagation(); deleteEdge(node.id, edge.target); }}
                                                                    title="Remove"
                                                                >
                                                                    <Unlink className="h-3 w-3 text-muted-foreground group-hover/btn:text-destructive transition-colors" />
                                                                </button>
                                                            </Badge>);
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">—</span>
                                            )}
                                        </td>
                                        {/* Add Connection */}
                                        <td className="px-3 py-2 align-middle w-[220px]">
                                            <div className="flex gap-1.5">
                                                <Select
                                                    value={newTargetForSource[node.id] || ""}
                                                    onValueChange={(val) => setNewTargetForSource((prev) => ({ ...prev, [node.id]: val }))}
                                                >
                                                    <SelectTrigger className="h-7 text-xs flex-1 bg-transparent">
                                                        <SelectValue placeholder="Select node..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {nodes
                                                            .filter((n) => n.id !== node.id)
                                                            .map((n) => (
                                                                <SelectItem key={n.id} value={n.id} className="text-xs">
                                                                    {n.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    size="sm"
                                                    className="h-7 w-7 p-0 shrink-0"
                                                    variant="secondary"
                                                    onClick={() => openConnectionDialog(node.id)}
                                                    disabled={!newTargetForSource[node.id]}
                                                    title="Add connection"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-middle text-center w-[50px]">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={() => deleteNode(node.id)}
                                                title="Delete Node"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        {nodes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground italic">
                                    No nodes found in the DFD graph.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ───── Add Connection Dialog ───── */}
            <Dialog open={connDialog.open} onOpenChange={(open) => !open && setConnDialog((prev) => ({ ...prev, open: false }))}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add Connection</DialogTitle>
                        <DialogDescription>
                            {connDialog.step === "direction"
                                ? `Choose the direction of the connection between "${connDialog.nodeName}" and "${selectedTargetName}".`
                                : `Select the flow type for this ${connDialog.direction === "in" ? "incoming" : "outgoing"} connection.`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {connDialog.step === "direction" ? (
                        <div className="py-4 space-y-3">
                            <p className="text-xs text-muted-foreground text-center mb-3">
                                Select direction relative to <strong>{connDialog.nodeName}</strong>
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => selectDirection("in")}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-border hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                                >
                                    <span className="text-2xl">↓</span>
                                    <span className="text-sm font-medium group-hover:text-green-600 dark:group-hover:text-green-400">Connection In</span>
                                    <span className="text-[10px] text-muted-foreground text-center">
                                        {selectedTargetName} → {connDialog.nodeName}
                                    </span>
                                </button>
                                <button
                                    onClick={() => selectDirection("out")}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                                >
                                    <span className="text-2xl">↑</span>
                                    <span className="text-sm font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">Connection Out</span>
                                    <span className="text-[10px] text-muted-foreground text-center">
                                        {connDialog.nodeName} → {selectedTargetName}
                                    </span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                                <span className={connDialog.direction === "in" ? "text-green-500" : "text-blue-500"}>
                                    {connDialog.direction === "in" ? "↓" : "↑"}
                                </span>
                                <span>
                                    {connDialog.direction === "in"
                                        ? `${selectedTargetName} → ${connDialog.nodeName}`
                                        : `${connDialog.nodeName} → ${selectedTargetName}`
                                    }
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Select flow type:</p>
                            <div className="grid grid-cols-1 gap-2">
                                {FLOW_TYPES.map((ft) => (
                                    <button
                                        key={ft}
                                        onClick={() => confirmConnection(ft)}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border hover:border-primary/50 transition-all text-left group ${FLOW_COLORS[ft] || ""}`}
                                    >
                                        <span className="text-sm font-medium capitalize">{ft}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" size="sm" onClick={() => setConnDialog((prev) => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                        </DialogClose>
                        {connDialog.step === "flow_type" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConnDialog((prev) => ({ ...prev, step: "direction", direction: "" }))}
                            >
                                ← Back
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ───── Delete Node Modal ───── */}
            <Dialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Node</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this node? This will also remove all its incoming and outgoing connections. You can recover it from the deleted items section.
                        </DialogDescription>
                    </DialogHeader>
                    {nodeToDelete && (
                        <div className="py-4 space-y-3 px-1 rounded-md bg-muted/30 border border-border">
                            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm px-3">
                                <span className="text-muted-foreground font-medium">Name:</span>
                                <span className="font-semibold text-foreground">{nodeToDelete.name}</span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm px-3">
                                <span className="text-muted-foreground font-medium">Type:</span>
                                <Badge variant="outline" className="w-fit capitalize">
                                    {nodeToDelete.type?.replace("_", " ") || "Unknown"}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm px-3">
                                <span className="text-muted-foreground font-medium">Connections:</span>
                                <span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                        In: {edges.filter((e) => e.target === nodeToDelete.id).length}
                                    </span>
                                    <span className="pointer-events-none mx-2 text-muted-foreground">|</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        Out: {edges.filter((e) => e.source === nodeToDelete.id).length}
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button variant="outline" onClick={() => setNodeToDelete(null)}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={confirmDeleteNode}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Node
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
