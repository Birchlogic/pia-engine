"use client";

import { useCallback, useMemo, useState } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type NodeTypes,
    MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { DFDNode } from "./dfd-node";

// ── Types ──

export type DFDGraphData = {
    id: string;
    status: string;
    createdAt: string;
    nodes: DFDNodeData[];
    edges: DFDEdgeData[];
};

export type DFDNodeData = {
    id: string;
    nodeType: string;
    label: string;
    metadata: Record<string, unknown> | null;
    positionX: number;
    positionY: number;
    riskLevel: string | null;
    verticalId: string | null;
};

export type DFDEdgeData = {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    dataElements: string[];
    dataClassification: string | null;
    processingType: string | null;
    isEncrypted: boolean;
    isCrossBorder: boolean;
    riskLevel: string;
    sourceNode: { id: string; label: string; nodeType: string };
    targetNode: { id: string; label: string; nodeType: string };
};

// ── Constants ──

const nodeTypeColors: Record<string, { bg: string; border: string; text: string }> = {
    data_source: { bg: "bg-blue-500/10", border: "border-blue-500/50", text: "text-blue-400" },
    processing_activity: { bg: "bg-purple-500/10", border: "border-purple-500/50", text: "text-purple-400" },
    data_store: { bg: "bg-green-500/10", border: "border-green-500/50", text: "text-green-400" },
    external_entity: { bg: "bg-orange-500/10", border: "border-orange-500/50", text: "text-orange-400" },
    system_application: { bg: "bg-cyan-500/10", border: "border-cyan-500/50", text: "text-cyan-400" },
    vertical_owner: { bg: "bg-primary/10", border: "border-primary/50", text: "text-primary" },
};

const riskColors: Record<string, string> = {
    low: "#22c55e",
    medium: "#eab308",
    high: "#f97316",
    critical: "#ef4444",
};

const edgeRiskStyles: Record<string, { stroke: string; strokeWidth: number }> = {
    low: { stroke: "#4ade80", strokeWidth: 1.5 },
    medium: { stroke: "#facc15", strokeWidth: 2 },
    high: { stroke: "#fb923c", strokeWidth: 2.5 },
    critical: { stroke: "#f87171", strokeWidth: 3 },
};

const nodeTypeLabels: Record<string, string> = {
    data_source: "Data Source",
    processing_activity: "Processing",
    data_store: "Data Store",
    external_entity: "External Entity",
    system_application: "System/App",
    vertical_owner: "Vertical Owner",
};

// ── Custom node types ──

const nodeTypes: NodeTypes = {
    dfdNode: DFDNode,
};

// ── Filters ──

type FilterState = {
    search: string;
    riskLevel: string;
    nodeType: string;
    classification: string;
    crossBorder: string;
    encrypted: string;
};

const defaultFilters: FilterState = {
    search: "",
    riskLevel: "all",
    nodeType: "all",
    classification: "all",
    crossBorder: "all",
    encrypted: "all",
};

// ── Component ──

interface DFDCanvasProps {
    graph: DFDGraphData;
}

export function DFDCanvas({ graph }: DFDCanvasProps) {
    const [filters, setFilters] = useState<FilterState>(defaultFilters);

    // Convert DB data to React Flow nodes/edges
    const { initialNodes, initialEdges } = useMemo(() => {
        const rfNodes: Node[] = graph.nodes.map((n) => ({
            id: n.id,
            type: "dfdNode",
            position: { x: n.positionX, y: n.positionY },
            data: {
                label: n.label,
                nodeType: n.nodeType,
                riskLevel: n.riskLevel,
                metadata: n.metadata,
                colors: nodeTypeColors[n.nodeType] || nodeTypeColors.data_source,
            },
        }));

        const rfEdges: Edge[] = graph.edges.map((e) => {
            const style = edgeRiskStyles[e.riskLevel] || edgeRiskStyles.low;
            return {
                id: e.id,
                source: e.sourceNodeId,
                target: e.targetNodeId,
                type: "default",
                animated: e.riskLevel === "critical" || e.riskLevel === "high",
                style: {
                    stroke: style.stroke,
                    strokeWidth: style.strokeWidth,
                    strokeDasharray: e.isCrossBorder ? "5 5" : undefined,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: style.stroke,
                    width: 16,
                    height: 16,
                },
                label: e.dataElements.length <= 2
                    ? e.dataElements.join(", ")
                    : `${e.dataElements.slice(0, 2).join(", ")} +${e.dataElements.length - 2}`,
                labelStyle: {
                    fontSize: 10,
                    fill: "#a1a1aa",
                    fontWeight: 500,
                },
                labelBgStyle: {
                    fill: "#18181b",
                    fillOpacity: 0.9,
                },
                labelBgPadding: [6, 4] as [number, number],
                labelBgBorderRadius: 4,
                data: {
                    dataElements: e.dataElements,
                    dataClassification: e.dataClassification,
                    processingType: e.processingType,
                    isEncrypted: e.isEncrypted,
                    isCrossBorder: e.isCrossBorder,
                    riskLevel: e.riskLevel,
                },
            };
        });

        return { initialNodes: rfNodes, initialEdges: rfEdges };
    }, [graph]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Apply filters
    const applyFilters = useCallback(() => {
        // Determine which edges pass filters
        const filteredEdgeIds = new Set<string>();
        const connectedNodeIds = new Set<string>();

        for (const edge of initialEdges) {
            const d = edge.data as DFDEdgeData | undefined;
            if (!d) {
                filteredEdgeIds.add(edge.id);
                connectedNodeIds.add(edge.source);
                connectedNodeIds.add(edge.target);
                continue;
            }

            // Classification filter
            if (filters.classification !== "all" && d.dataClassification !== filters.classification) continue;

            // Cross-border filter
            if (filters.crossBorder === "yes" && !d.isCrossBorder) continue;
            if (filters.crossBorder === "no" && d.isCrossBorder) continue;

            // Encrypted filter
            if (filters.encrypted === "yes" && !d.isEncrypted) continue;
            if (filters.encrypted === "no" && d.isEncrypted) continue;

            // Risk level filter on edges
            if (filters.riskLevel !== "all") {
                const minPriority = riskPriority(filters.riskLevel);
                if (riskPriority(d.riskLevel || "low") < minPriority) continue;
            }

            filteredEdgeIds.add(edge.id);
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
        }

        // Filter nodes
        const filteredNodes = initialNodes.map((node) => {
            const nd = node.data as { label: string; nodeType: string; riskLevel: string | null };
            let visible = true;

            // Node type filter
            if (filters.nodeType !== "all" && nd.nodeType !== filters.nodeType) visible = false;

            // Search filter
            if (filters.search) {
                const q = filters.search.toLowerCase();
                const matchesLabel = nd.label.toLowerCase().includes(q);
                // Also check if any connected edge has matching data elements
                const matchesEdge = initialEdges.some(
                    (e) =>
                        (e.source === node.id || e.target === node.id) &&
                        (e.data as { dataElements?: string[] })?.dataElements?.some((de: string) =>
                            de.toLowerCase().includes(q)
                        )
                );
                if (!matchesLabel && !matchesEdge) visible = false;
            }

            // If edge filters are active, only show connected nodes
            const hasActiveEdgeFilter =
                filters.classification !== "all" ||
                filters.crossBorder !== "all" ||
                filters.encrypted !== "all" ||
                (filters.riskLevel !== "all");

            if (hasActiveEdgeFilter && !connectedNodeIds.has(node.id)) visible = false;

            return {
                ...node,
                hidden: !visible,
                style: {
                    ...node.style,
                    opacity: visible ? 1 : 0.15,
                },
            };
        });

        // Filter edges
        const filteredEdges = initialEdges.map((edge) => ({
            ...edge,
            hidden: !filteredEdgeIds.has(edge.id),
            style: {
                ...edge.style,
                opacity: filteredEdgeIds.has(edge.id) ? 1 : 0.1,
            },
        }));

        setNodes(filteredNodes);
        setEdges(filteredEdges);
    }, [filters, initialNodes, initialEdges, setNodes, setEdges]);

    // Apply filters whenever they change
    useMemo(() => {
        applyFilters();
    }, [applyFilters]);

    const resetFilters = () => setFilters(defaultFilters);
    const hasActiveFilters = Object.entries(filters).some(
        ([k, v]) => v !== defaultFilters[k as keyof FilterState]
    );

    // Stats
    const stats = useMemo(() => {
        const visibleNodes = nodes.filter((n) => !n.hidden).length;
        const visibleEdges = edges.filter((e) => !e.hidden).length;
        const crossBorderEdges = graph.edges.filter((e) => e.isCrossBorder).length;
        const highRiskNodes = graph.nodes.filter(
            (n) => n.riskLevel === "high" || n.riskLevel === "critical"
        ).length;
        const unencryptedEdges = graph.edges.filter((e) => !e.isEncrypted).length;
        return { visibleNodes, visibleEdges, crossBorderEdges, highRiskNodes, unencryptedEdges };
    }, [nodes, edges, graph]);

    return (
        <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-5 gap-3">
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Nodes</p>
                        <p className="text-2xl font-bold">{stats.visibleNodes}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Data Flows</p>
                        <p className="text-2xl font-bold">{stats.visibleEdges}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">High Risk</p>
                        <p className="text-2xl font-bold text-red-400">{stats.highRiskNodes}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Cross-Border</p>
                        <p className="text-2xl font-bold text-orange-400">{stats.crossBorderEdges}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Unencrypted</p>
                        <p className="text-2xl font-bold text-yellow-400">{stats.unencryptedEdges}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Canvas */}
            <div className="rounded-lg border bg-background" style={{ height: 600 }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    minZoom={0.1}
                    maxZoom={2}
                    proOptions={{ hideAttribution: true }}
                    className="bg-background"
                >
                    <Background color="#27272a" gap={20} size={1} />
                    <Controls className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />
                    <MiniMap
                        nodeColor={(node) => {
                            const rl = (node.data as { riskLevel?: string })?.riskLevel;
                            return riskColors[rl || "low"] || "#71717a";
                        }}
                        maskColor="rgba(0,0,0,0.7)"
                        className="!bg-card !border-border"
                    />

                    {/* Filter panel */}
                    <Panel position="top-left" className="!m-3">
                        <Card className="w-[280px] bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
                            <CardContent className="p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetFilters}>
                                            Reset
                                        </Button>
                                    )}
                                </div>

                                <Input
                                    placeholder="Search nodes & elements..."
                                    value={filters.search}
                                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                    className="h-8 text-xs"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <FilterSelect
                                        label="Risk Level"
                                        value={filters.riskLevel}
                                        onChange={(v) => setFilters((f) => ({ ...f, riskLevel: v }))}
                                        options={[
                                            { value: "all", label: "All Risks" },
                                            { value: "critical", label: "Critical" },
                                            { value: "high", label: "High+" },
                                            { value: "medium", label: "Medium+" },
                                        ]}
                                    />
                                    <FilterSelect
                                        label="Node Type"
                                        value={filters.nodeType}
                                        onChange={(v) => setFilters((f) => ({ ...f, nodeType: v }))}
                                        options={[
                                            { value: "all", label: "All Types" },
                                            { value: "data_source", label: "Data Source" },
                                            { value: "system_application", label: "System/App" },
                                            { value: "data_store", label: "Data Store" },
                                            { value: "external_entity", label: "External" },
                                            { value: "processing_activity", label: "Processing" },
                                        ]}
                                    />
                                    <FilterSelect
                                        label="Classification"
                                        value={filters.classification}
                                        onChange={(v) => setFilters((f) => ({ ...f, classification: v }))}
                                        options={[
                                            { value: "all", label: "All Classes" },
                                            { value: "personal", label: "Personal" },
                                            { value: "sensitive_personal", label: "Sensitive" },
                                            { value: "non_personal", label: "Non-Personal" },
                                        ]}
                                    />
                                    <FilterSelect
                                        label="Cross-Border"
                                        value={filters.crossBorder}
                                        onChange={(v) => setFilters((f) => ({ ...f, crossBorder: v }))}
                                        options={[
                                            { value: "all", label: "All" },
                                            { value: "yes", label: "Cross-Border" },
                                            { value: "no", label: "Domestic" },
                                        ]}
                                    />
                                </div>

                                <FilterSelect
                                    label="Encryption"
                                    value={filters.encrypted}
                                    onChange={(v) => setFilters((f) => ({ ...f, encrypted: v }))}
                                    options={[
                                        { value: "all", label: "All Encryption" },
                                        { value: "yes", label: "Encrypted" },
                                        { value: "no", label: "Unencrypted" },
                                    ]}
                                />
                            </CardContent>
                        </Card>
                    </Panel>

                    {/* Legend */}
                    <Panel position="bottom-left" className="!m-3">
                        <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
                            <CardContent className="p-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legend</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {Object.entries(nodeTypeLabels).map(([type, label]) => (
                                        <div key={type} className="flex items-center gap-1.5">
                                            <div
                                                className={`w-3 h-3 rounded-sm ${nodeTypeColors[type]?.bg} ${nodeTypeColors[type]?.border} border`}
                                            />
                                            <span className="text-[10px] text-muted-foreground">{label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1">
                                    {Object.entries(riskColors).map(([level, color]) => (
                                        <div key={level} className="flex items-center gap-1.5">
                                            <div className="w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                                            <span className="text-[10px] text-muted-foreground capitalize">{level}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-0.5 rounded border-dashed border-t-2 border-orange-400" />
                                        <span className="text-[10px] text-muted-foreground">Cross-Border</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
}

// ── Filter Select helper ──

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// ── Helpers ──

function riskPriority(level: string): number {
    switch (level) {
        case "critical": return 4;
        case "high": return 3;
        case "medium": return 2;
        case "low": return 1;
        default: return 0;
    }
}
