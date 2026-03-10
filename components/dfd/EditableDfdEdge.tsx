"use client";

import React, { memo } from "react";
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
} from "@xyflow/react";

const FLOW_COLORS: Record<string, string> = {
    collection: "#ef4444",
    transfer: "#3b82f6",
    processing: "#22c55e",
    storage: "#a855f7",
    dispersal: "#f97316",
};

function EditableDfdEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
    });

    const flowType: string = (data?.flow_type as string) || "transfer";
    const color = FLOW_COLORS[flowType] || "#94a3b8";
    const label: string = (data?.label as string) || "";
    const inferred: boolean = (data?.inferred as boolean) || false;
    const channel: string = (data?.channel as string) || "";
    const evidence: string[] = (data?.evidence as string[]) || [];
    const onDelete = data?.onDelete as ((id: string) => void) | undefined;
    const isActive: boolean = (data?.isActive as boolean) ?? false;
    const isDimmed: boolean = (data?.isDimmed as boolean) ?? false;

    const edgeOpacity = isDimmed ? 0.08 : 1;

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: color,
                    strokeWidth: isActive ? 3.5 : selected ? 3 : isDimmed ? 1 : 2,
                    strokeDasharray: inferred ? "5 5" : undefined,
                    filter: isActive ? `drop-shadow(0 0 6px ${color})` : selected ? `drop-shadow(0 0 4px ${color})` : undefined,
                    opacity: edgeOpacity,
                    transition: "opacity 0.3s, stroke-width 0.3s",
                }}
            />

            {/* Animated flow dot — only shown when edge is active (connected to clicked node) */}
            {isActive && (
                <circle r="4" fill={color} opacity={0.9}>
                    <animateMotion dur={inferred ? "3s" : "1.8s"} repeatCount="indefinite" path={edgePath} />
                </circle>
            )}

            {/* Labels — only show when not dimmed */}
            {!isDimmed && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: "all",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            background: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                            backdropFilter: "blur(2px)",
                            padding: isActive ? "4px 8px" : "2px 4px",
                            borderRadius: 6,
                            border: isActive ? `1px solid ${color}40` : "none",
                            boxShadow: isActive ? `0 2px 8px ${color}20` : "none",
                            transition: "all 0.3s",
                        }}
                    >
                        {/* Flow Label */}
                        <div style={{
                            maxWidth: 160, textAlign: "center",
                            fontSize: isActive ? 9 : 8, fontWeight: 600,
                            color: "#334155", lineHeight: 1.2, wordWrap: "break-word",
                        }}>
                            {label || flowType}
                        </div>

                        {/* Meta pills */}
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                            {inferred && (
                                <span style={{
                                    background: "#f1f5f9", color: "#64748b",
                                    border: "1px dashed #cbd5e1", borderRadius: 4,
                                    padding: "1px 4px", fontSize: 7, fontWeight: 600,
                                    textTransform: "uppercase",
                                }}>INFERRED</span>
                            )}
                            {channel && (
                                <span style={{
                                    background: color + "15", color: color,
                                    border: `1px solid ${color}40`, borderRadius: 4,
                                    padding: "1px 4px", fontSize: 7, fontWeight: 600,
                                }}>via {channel}</span>
                            )}
                            {evidence.length > 0 && (
                                <span style={{
                                    background: "#fef3c7", color: "#d97706",
                                    border: "1px solid #fde68a", borderRadius: 4,
                                    padding: "1px 4px", fontSize: 7, fontWeight: 600,
                                }}>📝 {evidence.length}</span>
                            )}
                        </div>

                        {/* Delete button */}
                        {selected && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                                style={{
                                    background: "#ef4444", color: "white", border: "none",
                                    borderRadius: 4, padding: "2px 8px", fontSize: 9,
                                    fontWeight: 700, cursor: "pointer", marginTop: 2,
                                    boxShadow: "0 2px 6px rgba(239,68,68,0.3)",
                                }}
                            >
                                ✕ Remove
                            </button>
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export default memo(EditableDfdEdge);
