"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    reconnectEdge,
    type Node,
    type Edge,
    type Connection,
    type OnConnect,
    type OnReconnect,
    MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import EditableDfdNode from "./EditableDfdNode";
import EditableDfdEdge from "./EditableDfdEdge";

/* ──────────────────── Types ──────────────────── */

export interface KGNode {
    id: string;
    name: string;
    type: string;
    aliases?: string[];
    data_elements?: string[];
    risks?: Array<{ risk_name: string; severity: string; description: string; source: string }>;
    sources?: string[];
}
export interface KGEdge {
    source: string;
    target: string;
    data_elements?: string[];
    flow_type?: string;
    channel?: string;
    inferred?: boolean;
    sources?: string[];
    evidence?: string[];
}
export interface KnowledgeGraph {
    nodes: KGNode[];
    edges: KGEdge[];
    metadata?: { total_nodes: number; total_edges: number; inferred_edges: number };
}

export interface DfdNode {
    id: string;
    name: string;
    dfd_type: string;
    shape: string;
    data_elements?: string[];
    risk_count: number;
}
export interface DfdFlow {
    from: string;
    to: string;
    label: string;
    inferred: boolean;
}
export interface PrivacyDfd {
    nodes: DfdNode[];
    flows: DfdFlow[];
}

export interface NodeStyle {
    shape: string;
    color: string;
    label: string;
}
export interface RenderPlan {
    layout: string;
    levels: string[][];
    node_styles: Record<string, NodeStyle>;
}

export interface DfdInput {
    knowledgeGraph: KnowledgeGraph;
    privacyDfd: PrivacyDfd;
    renderPlan: RenderPlan;
}

/* ──────────────────── Layout Constants ──────────────────── */

const LEVEL_X_SPACING = 300;
const INTRA_LEVEL_Y_SPACING = 160;
const NODE_X_OFFSET = 60; // offset of nodes inside their category box

const FLOW_COLORS: Record<string, string> = {
    collection: "#ef4444",
    transfer: "#3b82f6",
    processing: "#22c55e",
    storage: "#a855f7",
    dispersal: "#f97316",
};

const LEVEL_STYLES = [
    { bg: "#eff6ff30", border: "#93c5fd", label: "#1d4ed8", headerBg: "#dbeafe" },
    { bg: "#f0fdf430", border: "#86efac", label: "#15803d", headerBg: "#dcfce7" },
    { bg: "#faf5ff30", border: "#d8b4fe", label: "#7e22ce", headerBg: "#f3e8ff" },
    { bg: "#fff7ed30", border: "#fdba74", label: "#c2410c", headerBg: "#ffedd5" },
    { bg: "#fef2f230", border: "#fca5a5", label: "#dc2626", headerBg: "#fee2e2" },
    { bg: "#f0fdfa30", border: "#5eead4", label: "#0f766e", headerBg: "#ccfbf1" },
];

/* ── Category Box Node (rendered as a React Flow node so it pans/zooms with canvas) ── */
function CategoryBoxNode({ data }: { data: Record<string, unknown> }) {
    const title = data.title as string;
    const color = data.borderColor as string;
    const bgColor = data.bgColor as string;
    const headerBg = data.headerBg as string;
    const labelColor = data.labelColor as string;

    return (
        <div style={{
            width: "100%",
            height: "100%",
            background: bgColor,
            border: `2px dashed ${color}`,
            borderRadius: 16,
            position: "relative",
        }}>
            <div style={{
                position: "absolute",
                top: -14,
                left: 16,
                background: headerBg,
                color: labelColor,
                padding: "3px 14px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.03em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                whiteSpace: "nowrap",
            }}>
                {title}
            </div>
        </div>
    );
}

/* ──────────────────── Category Name Derivation ──────────────────── */

function deriveCategoryName(nodesInLevel: DfdNode[], kgNodeMap: Map<string, KGNode>, levelIdx: number): string {
    if (nodesInLevel.length === 0) return `Category ${levelIdx + 1}`;

    // Count node types in this level
    const typeCounts: Record<string, number> = {};
    nodesInLevel.forEach((dn) => {
        const kn = kgNodeMap.get(dn.id);
        const t = kn?.type || dn.dfd_type || "unknown";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
    const total = nodesInLevel.length;

    // Check for specific patterns
    const hasDataStores = (typeCounts["data_store"] || 0) > 0;
    const hasActors = (typeCounts["actor"] || 0) > 0;
    const hasSystems = (typeCounts["system"] || 0) > 0;

    if (hasActors && !hasSystems && !hasDataStores) return `External Entities (${total})`;
    if (hasActors && hasSystems) return `Actors & Systems (${total})`;
    if (dominant === "actor") return `External Entities (${total})`;
    if (dominant === "system" && hasDataStores) return `Systems & Data Stores (${total})`;
    if (dominant === "system") return `Systems & Tools (${total})`;
    if (dominant === "data_store") return `Data Stores (${total})`;
    if (dominant === "unknown" && hasActors) return `Entities & Actors (${total})`;

    // Fallback: position-based naming
    const positionNames = ["Collection", "Processing", "Central Storage", "Communication", "Operations", "Output"];
    return `${positionNames[levelIdx] || "Category " + (levelIdx + 1)} (${total})`;
}

/* ──────────────────── Build React Flow data ──────────────────── */

function buildReactFlowData(
    input: DfdInput,
    onRename: (id: string, name: string) => void,
    onDeleteEdge: (id: string) => void,
    onDeleteNode: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
    const { knowledgeGraph: kg, privacyDfd: dfd, renderPlan: rp } = input;

    // Build name → level AND id → level maps (render plan uses display names)
    const nameLevelMap: Record<string, number> = {};
    rp.levels.forEach((names, levelIdx) => {
        names.forEach((name) => { nameLevelMap[name] = levelIdx; });
    });

    // Also build id→level from node_styles labels
    const idLevelMap: Record<string, number> = {};
    Object.entries(rp.node_styles).forEach(([nodeId, style]) => {
        if (style.label && nameLevelMap[style.label] !== undefined) {
            idLevelMap[nodeId] = nameLevelMap[style.label];
        }
    });

    const kgNodeMap = new Map(kg.nodes.map((n) => [n.id, n]));

    // Group DFD nodes by level (try name first, then id)
    const levelGroups: Record<number, DfdNode[]> = {};
    dfd.nodes.forEach((dn) => {
        const levelIdx = nameLevelMap[dn.name] ?? idLevelMap[dn.id] ?? 0;
        if (!levelGroups[levelIdx]) levelGroups[levelIdx] = [];
        levelGroups[levelIdx].push(dn);
    });

    const allNodes: Node[] = [];

    // 1. Create category box nodes + actual DFD nodes inside them
    const totalLevels = rp.levels.length;
    for (let levelIdx = 0; levelIdx < totalLevels; levelIdx++) {
        const nodesInLevel = levelGroups[levelIdx] || [];
        const style = LEVEL_STYLES[levelIdx % LEVEL_STYLES.length];
        const boxId = `__category_${levelIdx}`;

        // Box dimensions — height scales with node count
        const boxW = 280;
        const boxH = Math.max(200, nodesInLevel.length * INTRA_LEVEL_Y_SPACING + 80);

        // Derive meaningful category name from node types
        const categoryTitle = deriveCategoryName(nodesInLevel, kgNodeMap, levelIdx);

        // Category box node
        allNodes.push({
            id: boxId,
            type: "categoryBox",
            position: { x: levelIdx * LEVEL_X_SPACING, y: 0 },
            data: {
                title: categoryTitle,
                borderColor: style.border,
                bgColor: style.bg,
                headerBg: style.headerBg,
                labelColor: style.label,
            },
            draggable: false,
            selectable: false,
            style: { width: boxW, height: boxH, zIndex: -1 },
        });

        // DFD nodes positioned inside the category box
        nodesInLevel.forEach((dn, withinIdx) => {
            const kn = kgNodeMap.get(dn.id);
            const nodeStyle = rp.node_styles[dn.id];

            allNodes.push({
                id: dn.id,
                type: "dfdNode",
                position: {
                    x: levelIdx * LEVEL_X_SPACING + NODE_X_OFFSET,
                    y: 50 + withinIdx * INTRA_LEVEL_Y_SPACING,
                },
                data: {
                    label: dn.name,
                    color: nodeStyle?.color || "#44cc44",
                    shape: dn.shape || nodeStyle?.shape || "circle",
                    dfd_type: dn.dfd_type,
                    kg_type: kn?.type || "unknown",
                    risk_count: dn.risk_count || 0,
                    data_elements: dn.data_elements || [],
                    risks: kn?.risks || [],
                    sources: kn?.sources || [],
                    isHighlighted: true,
                    onRename,
                    onDeleteNode,
                },
            });
        });
    }

    // 2. Build edges
    const kgEdgeMap = new Map<string, KGEdge>();
    kg.edges.forEach((e) => {
        kgEdgeMap.set(`${e.source}→${e.target}`, e);
    });

    const rfEdges: Edge[] = dfd.flows.map((flow, i) => {
        const kgEdge = kgEdgeMap.get(`${flow.from}→${flow.to}`);
        return {
            id: `flow-${i}-${flow.from}-${flow.to}`,
            source: flow.from,
            target: flow.to,
            type: "dfdEdge",
            data: {
                label: flow.label || "",
                flow_type: kgEdge?.flow_type || "transfer",
                channel: kgEdge?.channel || "",
                data_elements: kgEdge?.data_elements || [],
                inferred: flow.inferred,
                evidence: kgEdge?.evidence || [],
                isActive: false,
                isDimmed: false,
                onDelete: onDeleteEdge,
            },
            markerEnd: { type: MarkerType.ArrowClosed },
            reconnectable: true,
        };
    });

    return { nodes: allNodes, edges: rfEdges };
}

/* ──────────────────── Reconstruct JSON ──────────────────── */

function reactFlowToInput(nodes: Node[], edges: Edge[], original: DfdInput): DfdInput {
    // Filter out category box nodes
    const dfdNodes = nodes.filter((n) => n.type === "dfdNode");

    const dfdNodesOut: DfdNode[] = dfdNodes.map((n) => ({
        id: n.id,
        name: (n.data.label as string) || n.id,
        dfd_type: (n.data.dfd_type as string) || "process",
        shape: (n.data.shape as string) || "circle",
        data_elements: (n.data.data_elements as string[]) || [],
        risk_count: (n.data.risk_count as number) || 0,
    }));

    const dfdFlows: DfdFlow[] = edges.map((e) => ({
        from: e.source,
        to: e.target,
        label: (e.data?.label as string) || "",
        inferred: (e.data?.inferred as boolean) || false,
    }));

    const kgNodes: KGNode[] = dfdNodes.map((n) => {
        const orig = original.knowledgeGraph.nodes.find((x) => x.id === n.id);
        return {
            id: n.id,
            name: (n.data.label as string) || n.id,
            type: (n.data.kg_type as string) || orig?.type || "unknown",
            aliases: orig?.aliases || [],
            data_elements: (n.data.data_elements as string[]) || [],
            risks: (n.data.risks as KGNode["risks"]) || [],
            sources: (n.data.sources as string[]) || [],
        };
    });

    const kgEdges: KGEdge[] = edges.map((e) => {
        const origEdge = original.knowledgeGraph.edges.find(
            (x) => x.source === e.source && x.target === e.target
        );
        return {
            source: e.source,
            target: e.target,
            data_elements: (e.data?.data_elements as string[]) || [],
            flow_type: (e.data?.flow_type as string) || "transfer",
            channel: (e.data?.channel as string) || "",
            inferred: (e.data?.inferred as boolean) || false,
            sources: origEdge?.sources || [],
            evidence: (e.data?.evidence as string[]) || [],
        };
    });

    const updatedStyles: Record<string, NodeStyle> = {};
    dfdNodes.forEach((n) => {
        updatedStyles[n.id] = {
            shape: (n.data.shape as string) || "circle",
            color: (n.data.color as string) || "#44cc44",
            label: (n.data.label as string) || n.id,
        };
    });

    // Rebuild levels by x-position
    const posGrp = new Map<number, string[]>();
    dfdNodes.forEach((n) => {
        const lvl = Math.round(n.position.x / LEVEL_X_SPACING);
        if (!posGrp.has(lvl)) posGrp.set(lvl, []);
        posGrp.get(lvl)!.push((n.data.label as string) || n.id);
    });
    const levels = Array.from(posGrp.entries()).sort(([a], [b]) => a - b).map(([, n]) => n);

    return {
        privacyDfd: { nodes: dfdNodesOut, flows: dfdFlows },
        knowledgeGraph: {
            nodes: kgNodes, edges: kgEdges,
            metadata: {
                total_nodes: kgNodes.length,
                total_edges: kgEdges.length,
                inferred_edges: kgEdges.filter((e) => e.inferred).length,
            },
        },
        renderPlan: {
            layout: original.renderPlan.layout || "left_to_right",
            levels,
            node_styles: updatedStyles,
        },
    };
}

/* ──────────────────── Undo History ──────────────────── */

interface HistoryEntry {
    nodes: Node[];
    edges: Edge[];
}

function useUndoRedo(maxHistory = 50) {
    const pastRef = useRef<HistoryEntry[]>([]);
    const futureRef = useRef<HistoryEntry[]>([]);

    const pushState = useCallback((nodes: Node[], edges: Edge[]) => {
        pastRef.current.push({
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
        });
        if (pastRef.current.length > maxHistory) pastRef.current.shift();
        futureRef.current = []; // clear redo on new action
    }, [maxHistory]);

    const undo = useCallback((): HistoryEntry | null => {
        if (pastRef.current.length < 2) return null; // need at least 2 (current + previous)
        const current = pastRef.current.pop()!;
        futureRef.current.push(current);
        return pastRef.current[pastRef.current.length - 1] || null;
    }, []);

    const redo = useCallback((): HistoryEntry | null => {
        if (futureRef.current.length === 0) return null;
        const entry = futureRef.current.pop()!;
        pastRef.current.push(entry);
        return entry;
    }, []);

    const canUndo = useCallback(() => pastRef.current.length >= 2, []);
    const canRedo = useCallback(() => futureRef.current.length > 0, []);

    return { pushState, undo, redo, canUndo, canRedo };
}

/* ──────────────────── Main Component ──────────────────── */

interface EditableDfdProps {
    data: DfdInput;
    onSave?: (updated: DfdInput) => void;
}

export default function EditableDfd({ data, onSave }: EditableDfdProps) {
    const nodeTypes = useMemo(() => ({ dfdNode: EditableDfdNode, categoryBox: CategoryBoxNode }), []);
    const edgeTypes = useMemo(() => ({ dfdEdge: EditableDfdEdge }), []);

    const [hasChanges, setHasChanges] = useState(false);
    const [originalData] = useState<DfdInput>(data);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo();

    const handleRename = useCallback((nodeId: string, newName: string) => {
        setNodes((nds) => {
            const updated = nds.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, label: newName } } : n
            );
            return updated;
        });
        setHasChanges(true);
    }, []);

    const handleDeleteEdge = useCallback((edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setHasChanges(true);
    }, []);

    const handleDeleteNode = useCallback((nodeId: string) => {
        // Save state for undo before deleting
        setNodes((nds) => {
            setEdges((eds) => {
                pushState(nds, eds);
                return eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
            });
            return nds.filter((n) => n.id !== nodeId);
        });
        setSelectedNodeId(null);
        setHasChanges(true);
    }, [pushState]);

    const initial = useMemo(
        () => buildReactFlowData(data, handleRename, handleDeleteEdge, handleDeleteNode),
        [data, handleRename, handleDeleteEdge, handleDeleteNode]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

    // Push initial state
    useEffect(() => {
        pushState(initial.nodes, initial.edges);
    }, [initial.nodes, initial.edges, pushState]);

    // Re-sync on external data change
    useEffect(() => {
        const fresh = buildReactFlowData(data, handleRename, handleDeleteEdge, handleDeleteNode);
        setNodes(fresh.nodes);
        setEdges(fresh.edges);
        setHasChanges(false);
        setSelectedNodeId(null);
    }, [data, handleRename, handleDeleteEdge, handleDeleteNode, setNodes, setEdges]);

    // Save snapshot on meaningful changes
    const saveSnapshot = useCallback(() => {
        setNodes((nds) => {
            setEdges((eds) => {
                pushState(nds, eds);
                return eds;
            });
            return nds;
        });
    }, [pushState, setNodes, setEdges]);

    // ── Keyboard shortcuts: Ctrl+Z / Ctrl+Y ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                const prev = undo();
                if (prev) {
                    // Re-inject callbacks
                    const restored = prev.nodes.map((n) =>
                        n.type === "dfdNode"
                            ? { ...n, data: { ...n.data, onRename: handleRename, onDeleteNode: handleDeleteNode } }
                            : n
                    );
                    const restoredEdges = prev.edges.map((e) => ({
                        ...e,
                        data: { ...e.data, onDelete: handleDeleteEdge },
                    }));
                    setNodes(restored);
                    setEdges(restoredEdges);
                    setHasChanges(true);
                }
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
                e.preventDefault();
                const next = redo();
                if (next) {
                    const restored = next.nodes.map((n) =>
                        n.type === "dfdNode"
                            ? { ...n, data: { ...n.data, onRename: handleRename, onDeleteNode: handleDeleteNode } }
                            : n
                    );
                    const restoredEdges = next.edges.map((e) => ({
                        ...e,
                        data: { ...e.data, onDelete: handleDeleteEdge },
                    }));
                    setNodes(restored);
                    setEdges(restoredEdges);
                    setHasChanges(true);
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [undo, redo, handleRename, handleDeleteNode, handleDeleteEdge, setNodes, setEdges]);

    // ── Highlight connected edges & nodes when a node is clicked ──
    useEffect(() => {
        if (!selectedNodeId) {
            setNodes((nds) => nds.map((n) => n.type === "dfdNode"
                ? { ...n, data: { ...n.data, isHighlighted: true } }
                : n
            ));
            setEdges((eds) => eds.map((e) => ({
                ...e, data: { ...e.data, isActive: false, isDimmed: false },
            })));
            return;
        }

        const connectedNodeIds = new Set<string>([selectedNodeId]);
        setEdges((eds) => eds.map((e) => {
            const isConnected = e.source === selectedNodeId || e.target === selectedNodeId;
            if (isConnected) {
                connectedNodeIds.add(e.source);
                connectedNodeIds.add(e.target);
            }
            return { ...e, data: { ...e.data, isActive: isConnected, isDimmed: !isConnected } };
        }));

        setNodes((nds) => nds.map((n) => n.type === "dfdNode"
            ? { ...n, data: { ...n.data, isHighlighted: connectedNodeIds.has(n.id) } }
            : n
        ));
    }, [selectedNodeId, setNodes, setEdges]);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === "categoryBox") return;
        setSelectedNodeId((prev) => prev === node.id ? null : node.id);
    }, []);

    const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

    const onConnect: OnConnect = useCallback(
        (connection: Connection) => {
            saveSnapshot();
            setEdges((eds) =>
                addEdge(
                    {
                        ...connection,
                        type: "dfdEdge",
                        data: {
                            label: "New Flow",
                            flow_type: "transfer",
                            channel: "",
                            data_elements: [],
                            inferred: false,
                            evidence: [],
                            isActive: false,
                            isDimmed: false,
                            onDelete: handleDeleteEdge,
                        },
                        markerEnd: { type: MarkerType.ArrowClosed },
                    },
                    eds
                )
            );
            setHasChanges(true);
        },
        [setEdges, handleDeleteEdge, saveSnapshot]
    );

    const onReconnect: OnReconnect = useCallback(
        (oldEdge: Edge, newConnection: Connection) => {
            saveSnapshot();
            setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
            setHasChanges(true);
        },
        [setEdges, saveSnapshot]
    );

    const onNodeDragStop = useCallback(() => {
        saveSnapshot();
        setHasChanges(true);
    }, [saveSnapshot]);

    const handleSave = useCallback(() => {
        const updated = reactFlowToInput(nodes, edges, originalData);
        onSave?.(updated);
        setHasChanges(false);
    }, [nodes, edges, originalData, onSave]);

    // Stats (exclude category boxes)
    const dfdNodes = nodes.filter((n) => n.type === "dfdNode");
    const totalNodes = dfdNodes.length;
    const totalEdges = edges.length;
    const inferredEdges = edges.filter((e) => e.data?.inferred).length;
    const totalRisks = dfdNodes.reduce((sum, n) => sum + ((n.data.risk_count as number) || 0), 0);

    return (
        <div style={{ width: "100%", height: "85vh", minHeight: 650, position: "relative" }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                defaultEdgeOptions={{ type: "dfdEdge" }}
                connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
                deleteKeyCode={["Backspace", "Delete"]}
                onEdgesDelete={() => { saveSnapshot(); setHasChanges(true); }}
                onNodesDelete={(deletedNodes) => {
                    saveSnapshot();
                    const ids = new Set(deletedNodes.map((n) => n.id));
                    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
                    setHasChanges(true);
                }}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={24} size={1} color="#e2e8f0" />
                <Controls position="bottom-left" />
                <MiniMap
                    nodeColor={(n) => {
                        if (n.type === "categoryBox") return "transparent";
                        return (n.data?.color as string) || "#44cc44";
                    }}
                    position="bottom-right"
                    style={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
                />

                {/* Stats bar */}
                <Panel position="top-center">
                    <div style={{
                        display: "flex", gap: 12, background: "white", borderRadius: 12,
                        padding: "8px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                        border: "1px solid #e2e8f0", fontSize: 11, alignItems: "center",
                    }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Privacy DFD</span>
                        <span style={{ color: "#64748b" }}>|</span>
                        <span style={{ color: "#3b82f6", fontWeight: 600 }}>🔵 {totalNodes} entities</span>
                        <span style={{ color: "#22c55e", fontWeight: 600 }}>🟢 {totalEdges} flows</span>
                        <span style={{ color: "#94a3b8" }}>({inferredEdges} inferred)</span>
                        {totalRisks > 0 && (
                            <span style={{ color: "#ef4444", fontWeight: 600 }}>⚠️ {totalRisks} risks</span>
                        )}
                        {selectedNodeId && (
                            <>
                                <span style={{ color: "#64748b" }}>|</span>
                                <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                                    🎯 {dfdNodes.find(n => n.id === selectedNodeId)?.data.label as string || selectedNodeId}
                                </span>
                                <button
                                    onClick={() => setSelectedNodeId(null)}
                                    style={{
                                        background: "#f1f5f9", border: "1px solid #e2e8f0",
                                        borderRadius: 6, padding: "2px 8px", fontSize: 10,
                                        fontWeight: 600, cursor: "pointer", color: "#64748b",
                                    }}
                                >
                                    Clear
                                </button>
                            </>
                        )}
                    </div>
                </Panel>

                {/* Save panel */}
                {hasChanges && (
                    <Panel position="top-right">
                        <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: "white", borderRadius: 12, padding: "10px 16px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
                        }}>
                            {/* Undo/Redo buttons */}
                            <button
                                onClick={() => {
                                    const prev = undo();
                                    if (prev) {
                                        setNodes(prev.nodes.map((n) => n.type === "dfdNode"
                                            ? { ...n, data: { ...n.data, onRename: handleRename, onDeleteNode: handleDeleteNode } } : n));
                                        setEdges(prev.edges.map((e) => ({ ...e, data: { ...e.data, onDelete: handleDeleteEdge } })));
                                    }
                                }}
                                disabled={!canUndo()}
                                title="Undo (Ctrl+Z)"
                                style={{
                                    background: canUndo() ? "#f1f5f9" : "#f8fafc",
                                    border: "1px solid #e2e8f0", borderRadius: 6,
                                    padding: "4px 10px", fontSize: 14, cursor: canUndo() ? "pointer" : "default",
                                    opacity: canUndo() ? 1 : 0.4,
                                }}
                            >↩️</button>
                            <button
                                onClick={() => {
                                    const next = redo();
                                    if (next) {
                                        setNodes(next.nodes.map((n) => n.type === "dfdNode"
                                            ? { ...n, data: { ...n.data, onRename: handleRename, onDeleteNode: handleDeleteNode } } : n));
                                        setEdges(next.edges.map((e) => ({ ...e, data: { ...e.data, onDelete: handleDeleteEdge } })));
                                    }
                                }}
                                disabled={!canRedo()}
                                title="Redo (Ctrl+Y)"
                                style={{
                                    background: canRedo() ? "#f1f5f9" : "#f8fafc",
                                    border: "1px solid #e2e8f0", borderRadius: 6,
                                    padding: "4px 10px", fontSize: 14, cursor: canRedo() ? "pointer" : "default",
                                    opacity: canRedo() ? 1 : 0.4,
                                }}
                            >↪️</button>

                            <div style={{
                                width: 8, height: 8, borderRadius: "50%", background: "#f97316",
                                animation: "pulse 2s infinite",
                            }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>
                                Unsaved
                            </span>
                            <button
                                onClick={handleSave}
                                style={{
                                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                                    color: "white", border: "none", borderRadius: 8,
                                    padding: "8px 20px", fontSize: 13, fontWeight: 600,
                                    cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                                    transition: "transform 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            >
                                💾 Save DFD
                            </button>
                        </div>
                    </Panel>
                )}

                {/* Legend */}
                <Panel position="top-left">
                    <div style={{
                        background: "white", borderRadius: 10, padding: "10px 14px",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0",
                        fontSize: 10, marginTop: 8,
                    }}>
                        <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: "#1e293b" }}>
                            Interaction Guide
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, color: "#64748b", fontSize: 9 }}>
                            <span>🖱️ Click node → highlight flows</span>
                            <span>✏️ Double-click → edit name</span>
                            <span>🗑️ Red × → delete node</span>
                            <span>🔗 Drag handles → connect</span>
                            <span>⌫ Select + Delete → remove</span>
                            <span>↩️ Ctrl+Z → undo</span>
                            <span>↪️ Ctrl+Y → redo</span>
                            <span>📍 Click empty → reset</span>
                        </div>
                        <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 6, paddingTop: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, color: "#1e293b" }}>
                                Flow Colors
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {Object.entries(FLOW_COLORS).map(([type, color]) => (
                                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ width: 16, height: 2, background: color, borderRadius: 1, display: "inline-block" }} />
                                        <span style={{ textTransform: "capitalize", fontSize: 9, color: "#64748b" }}>{type}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 16, height: 0, borderTop: "2px dashed #94a3b8", display: "inline-block" }} />
                                    <span style={{ color: "#94a3b8", fontSize: 9 }}>Inferred</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
