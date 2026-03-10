"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Plus, Link as LinkIcon, Unlink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// Fallbacks if not provided by API
import fallbackKnowledgeGraph from "@/knowledge_graph.json";
import fallbackPrivacyDfd from "@/privacy_dfd.json";
import fallbackRenderPlan from "@/dfd_render_plan.json";

export interface ListBasedDfdEditorProps {
    data: any; // The raw data from API response
    onSave: (updatedData: any) => Promise<void>;
}

export default function ListBasedDfdEditor({ data, onSave }: ListBasedDfdEditorProps) {
    const [saving, setSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Determine active graphs, using fallbacks if API data is missing or empty
    const initialKg = (data?.knowledge_graph?.nodes && data.knowledge_graph.nodes.length > 0)
        ? data.knowledge_graph
        : (data?.dfd_json?.nodes && data.dfd_json.nodes.length > 0) ? data.dfd_json : fallbackKnowledgeGraph;

    const initialDfd = (data?.privacy_dfd?.nodes && data.privacy_dfd.nodes.length > 0)
        ? data.privacy_dfd
        : fallbackPrivacyDfd;

    const initialPlan = (data?.dfd_render_plan?.levels && data.dfd_render_plan.levels.length > 0)
        ? data.dfd_render_plan
        : fallbackRenderPlan;

    // We keep state of nodes and edges locally to edit
    const [kgNodes, setKgNodes] = useState<any[]>([]);
    const [kgEdges, setKgEdges] = useState<any[]>([]);
    const [dfdNodes, setDfdNodes] = useState<any[]>([]);
    const [dfdFlows, setDfdFlows] = useState<any[]>([]);

    useEffect(() => {
        setKgNodes(initialKg?.nodes ? JSON.parse(JSON.stringify(initialKg.nodes)) : []);
        setKgEdges(initialKg?.edges ? JSON.parse(JSON.stringify(initialKg.edges)) : []);
        setDfdNodes(initialDfd?.nodes ? JSON.parse(JSON.stringify(initialDfd.nodes)) : []);
        setDfdFlows(initialDfd?.flows ? JSON.parse(JSON.stringify(initialDfd.flows)) : []);
    }, [initialKg, initialDfd]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedKg = { ...initialKg, nodes: kgNodes, edges: kgEdges };
            const updatedDfd = { ...initialDfd, nodes: dfdNodes, flows: dfdFlows };

            await onSave({
                knowledgeGraph: updatedKg,
                privacyDfd: updatedDfd,
                renderPlan: initialPlan
            });
        } finally {
            setSaving(false);
        }
    };

    // --- Actions ---

    const deleteNode = (nodeId: string) => {
        if (!confirm("Are you sure you want to delete this node and all its connections?")) return;

        setKgNodes(prev => prev.filter(n => n.id !== nodeId));
        setKgEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));

        setDfdNodes(prev => prev.filter(n => n.id !== nodeId));
        setDfdFlows(prev => prev.filter(f => f.from !== nodeId && f.to !== nodeId));
    };

    const deleteEdge = (source: string, target: string) => {
        setKgEdges(prev => prev.filter(e => !(e.source === source && e.target === target)));
        setDfdFlows(prev => prev.filter(f => !(f.from === source && f.to === target)));
    };

    const [newTargetForSource, setNewTargetForSource] = useState<Record<string, string>>({});

    const addEdge = (source: string) => {
        const target = newTargetForSource[source];
        if (!target) return;

        // Check if edge already exists
        const exists = kgEdges.some(e => e.source === source && e.target === target);
        if (exists) {
            toast.error("This connection already exists");
            return;
        }

        // Add to KG
        setKgEdges(prev => [...prev, {
            source,
            target,
            flow_type: "transfer",
            inferred: false,
            data_elements: []
        }]);

        // Add to DFD
        setDfdFlows(prev => [...prev, {
            from: source,
            to: target,
            label: "New Connection",
            inferred: false
        }]);

        setNewTargetForSource(prev => ({ ...prev, [source]: "" }));
        toast.success("Connection added");
    };

    // Helper map for node names
    const nodeMap = useMemo(() => {
        const map = new Map<string, string>();
        kgNodes.forEach(n => map.set(n.id, n.name || n.id));
        return map;
    }, [kgNodes]);

    // Grouping nodes by type for cleaner display
    const groupedNodes = useMemo(() => {
        const groups: Record<string, any[]> = { "actor": [], "system": [], "data_store": [], "process": [], "unknown": [] };
        kgNodes.forEach(n => {
            const t = n.type || "unknown";
            if (!groups[t]) groups[t] = [];
            groups[t].push(n);
        });
        return Object.entries(groups).filter(([_, arr]) => arr.length > 0);
    }, [kgNodes]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="space-y-4 bg-card text-card-foreground p-4 rounded-lg border border-border shadow-sm"
        >
            <div className="flex justify-between items-center bg-card text-card-foreground rounded-lg border-border">
                <div className="flex items-center gap-3">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-muted/50 rounded-md transition-transform duration-200">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </CollapsibleTrigger>
                    <div>
                        <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-blue-500" />
                            DFD Relational Editor
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1.5">
                            Modify node connections and remove unneeded nodes for structural DFD generation.
                        </p>
                    </div>
                </div>
                <Button onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                }} disabled={saving} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {saving ? "Saving..." : "Save DFD Configuration"}
                </Button>
            </div>

            <CollapsibleContent>
                <div className="pt-4 border-t border-border">
                    <div className="overflow-x-auto rounded-lg border border-border w-full">
                        <table className="w-full min-w-max text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Node</th>
                                    <th className="px-4 py-3 font-medium">Type</th>
                                    <th className="px-4 py-3 font-medium text-center">In / Out</th>
                                    <th className="px-4 py-3 font-medium">Connections (Flows)</th>
                                    <th className="px-4 py-3 font-medium">Add Connection</th>
                                    <th className="px-4 py-3 font-medium text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {groupedNodes.flatMap(([type, nodesGroup]) =>
                                    nodesGroup.map((node) => {
                                        const outgoing = kgEdges.filter(e => e.source === node.id);
                                        const incoming = kgEdges.filter(e => e.target === node.id);

                                        // Dynamic color based on node type
                                        const typeColors: Record<string, string> = {
                                            "actor": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
                                            "system": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                                            "data_store": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
                                            "process": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                                            "unknown": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                                        };
                                        const badgeColor = typeColors[type] || typeColors["unknown"];

                                        return (
                                            <tr key={node.id} className="hover:bg-muted/20 group transition-colors">
                                                {/* Node Name & ID */}
                                                <td className="px-4 py-2 align-middle max-w-[200px] truncate" title={node.name}>
                                                    <div className="font-medium text-foreground truncate">{node.name}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate">{node.id}</div>
                                                </td>

                                                {/* Node Type */}
                                                <td className="px-4 py-2 align-middle">
                                                    <Badge variant="outline" className={`text-xs font-medium whitespace-nowrap capitalize ${badgeColor}`}>
                                                        {type.replace("_", " ")}
                                                    </Badge>
                                                </td>

                                                {/* In / Out Stats */}
                                                <td className="px-4 py-2 align-middle text-center">
                                                    <div className="flex items-center justify-center gap-2 text-xs">
                                                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400" title="Incoming">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7 7 7-7" /><path d="M12 19V5" /></svg>
                                                            {incoming.length}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Outgoing">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 12-7-7-7 7" /><path d="M12 5v14" /></svg>
                                                            {outgoing.length}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Connections */}
                                                <td className="px-4 py-2 align-middle">
                                                    {outgoing.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5 max-w-[350px]">
                                                            {outgoing.map(edge => (
                                                                <Badge
                                                                    key={`${edge.source}-${edge.target}`}
                                                                    variant="secondary"
                                                                    className="text-[11px] font-normal flex items-center gap-1 pr-1 pl-2 py-0 bg-secondary/50 hover:bg-secondary/70 border-border/50 transition-colors"
                                                                >
                                                                    <span className="truncate max-w-[150px]" title={nodeMap.get(edge.target) || edge.target}>
                                                                        {nodeMap.get(edge.target) || edge.target}
                                                                    </span>
                                                                    <button
                                                                        className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive group/btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteEdge(node.id, edge.target);
                                                                        }}
                                                                        title="Remove Connection"
                                                                    >
                                                                        <Unlink className="h-3 w-3 text-muted-foreground group-hover/btn:text-destructive transition-colors" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No flows</span>
                                                    )}
                                                </td>

                                                {/* Add Connection */}
                                                <td className="px-4 py-2 align-middle w-[250px]">
                                                    <div className="flex gap-1.5">
                                                        <Select
                                                            value={newTargetForSource[node.id] || ""}
                                                            onValueChange={(val) => setNewTargetForSource(prev => ({ ...prev, [node.id]: val }))}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs flex-1 bg-transparent">
                                                                <SelectValue placeholder="Add connection..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {kgNodes.filter(n => n.id !== node.id && !outgoing.some(e => e.target === n.id)).map(n => (
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
                                                            onClick={() => addEdge(node.id)}
                                                            disabled={!newTargetForSource[node.id]}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-2 align-middle text-center w-[60px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
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
                                {kgNodes.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground italic">
                                            No nodes found in the DFD graph.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CollapsibleContent>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
            `}</style>
        </Collapsible>
    );
}
