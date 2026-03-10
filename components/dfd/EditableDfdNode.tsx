"use client";

import React, { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/* ─── Shape styling based on dfd_type / shape ─── */
const SHAPE_STYLES: Record<string, React.CSSProperties> = {
    circle: { borderRadius: "50%", width: 120, height: 120, padding: 12 },
    open_rectangle: { borderRadius: 4, border: "2px solid", borderTop: "none", padding: "18px 14px 10px" },
};

function EditableDfdNode({ id, data, selected }: NodeProps) {
    const nodeColor: string = (data.color as string) || "#44cc44";
    const shape: string = (data.shape as string) || "circle";
    const riskCount: number = (data.risk_count as number) || 0;
    const dataElements: string[] = (data.data_elements as string[]) || [];
    const dfdType: string = (data.dfd_type as string) || "process";
    const kgType: string = (data.kg_type as string) || "unknown";
    const isHighlighted: boolean = (data.isHighlighted as boolean) ?? true;

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(data.label as string || "");

    const onRename = data.onRename as ((id: string, name: string) => void) | undefined;
    const onDeleteNode = data.onDeleteNode as ((id: string) => void) | undefined;

    const handleDoubleClick = useCallback(() => setEditing(true), []);
    const handleBlur = useCallback(() => {
        setEditing(false);
        if (onRename) onRename(id, name);
    }, [id, name, onRename]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") { setEditing(false); if (onRename) onRename(id, name); }
        if (e.key === "Escape") { setName(data.label as string || ""); setEditing(false); }
    }, [id, name, data.label, onRename]);

    const isCircle = shape === "circle";
    const isDataStore = dfdType === "data_store" || shape === "open_rectangle";

    const typeEmoji = isDataStore ? "💾" : kgType === "actor" ? "👤" : kgType === "system" ? "🖥️" : "⚙️";
    const borderColor = nodeColor;
    const bgColor = nodeColor + "18";

    const baseStyles: React.CSSProperties = {
        ...(isCircle ? SHAPE_STYLES.circle : SHAPE_STYLES.open_rectangle),
        background: bgColor,
        borderColor: borderColor,
        border: isDataStore
            ? `2px solid ${borderColor}`
            : `2.5px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: selected
            ? `0 0 0 3px ${borderColor}, 0 8px 28px rgba(0,0,0,0.18)`
            : `0 2px 10px ${borderColor}30`,
        cursor: "grab",
        transition: "box-shadow 0.25s, transform 0.2s, opacity 0.3s",
        minWidth: isCircle ? 120 : 140,
        opacity: isHighlighted ? 1 : 0.25,
    };

    if (isDataStore) {
        baseStyles.borderTop = "none";
        baseStyles.borderRadius = 0;
        baseStyles.borderBottomLeftRadius = 6;
        baseStyles.borderBottomRightRadius = 6;
    }

    return (
        <div style={baseStyles}>
            {/* Handles */}
            <Handle type="target" position={Position.Top}
                style={{ background: borderColor, width: 8, height: 8, border: "2px solid white" }} />
            <Handle type="target" position={Position.Left}
                style={{ background: borderColor, width: 8, height: 8, border: "2px solid white" }} />
            <Handle type="source" position={Position.Bottom}
                style={{ background: borderColor, width: 8, height: 8, border: "2px solid white" }} />
            <Handle type="source" position={Position.Right}
                style={{ background: borderColor, width: 8, height: 8, border: "2px solid white" }} />

            {/* Risk badge */}
            {riskCount > 0 && (
                <span style={{
                    position: "absolute", top: -8, right: -8, width: 22, height: 22,
                    background: "#ef4444", color: "white", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
                    zIndex: 10,
                }}>
                    {riskCount}
                </span>
            )}

            {/* Delete button — shown when selected */}
            {selected && onDeleteNode && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteNode(id); }}
                    title="Delete this node"
                    style={{
                        position: "absolute", top: -10, left: -10,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "#ef4444", color: "white", border: "2px solid white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(239,68,68,0.4)", zIndex: 10,
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            )}

            {/* Rename button — shown when selected */}
            {selected && !editing && (
                <button
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    title="Rename this node"
                    style={{
                        position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
                        borderRadius: 6, background: "#3b82f6", color: "white",
                        border: "2px solid white", padding: "1px 8px",
                        fontSize: 9, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(59,130,246,0.4)", zIndex: 10,
                        whiteSpace: "nowrap",
                    }}
                >
                    ✏️ Rename
                </button>
            )}

            {/* Type icon */}
            <span style={{ fontSize: 16, marginBottom: 2 }}>{typeEmoji}</span>

            {/* Name (editable) */}
            {editing ? (
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{
                        fontSize: 11, fontWeight: 600, color: "#1e293b",
                        background: "white", border: `1px solid ${borderColor}`,
                        borderRadius: 4, padding: "2px 6px", width: "90%",
                        outline: "none", textAlign: "center",
                    }}
                />
            ) : (
                <div onDoubleClick={handleDoubleClick} title="Double-click to rename"
                    style={{
                        fontSize: isCircle ? 10 : 11,
                        fontWeight: 600, color: "#1e293b",
                        textAlign: "center", lineHeight: 1.2, cursor: "text",
                        maxWidth: isCircle ? 96 : 120, wordBreak: "break-word",
                    }}>
                    {name}
                </div>
            )}

            {/* Type label */}
            <div style={{
                fontSize: 8, color: "#64748b", textTransform: "uppercase",
                letterSpacing: "0.06em", marginTop: 2,
            }}>
                {isDataStore ? "data store" : kgType}
            </div>

            {/* Data elements count */}
            {dataElements.length > 0 && (
                <div style={{
                    fontSize: 8, color: borderColor, fontWeight: 600,
                    marginTop: 3, background: borderColor + "15",
                    borderRadius: 8, padding: "1px 6px",
                }}>
                    {dataElements.length} data elem.
                </div>
            )}
        </div>
    );
}

export default memo(EditableDfdNode);
