"use client";

import React, { useEffect, useState } from "react";
import EditableDfd, { type DfdInput, type KnowledgeGraph, type PrivacyDfd, type RenderPlan } from "@/components/dfd/EditableDfd";

export default function TestDfdPage() {
    const [data, setData] = useState<DfdInput | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savedJson, setSavedJson] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [kgRes, dfdRes, rpRes] = await Promise.all([
                    fetch("/test-data/knowledge_graph.json"),
                    fetch("/test-data/privacy_dfd.json"),
                    fetch("/test-data/dfd_render_plan.json"),
                ]);

                if (!kgRes.ok || !dfdRes.ok || !rpRes.ok) {
                    throw new Error("Failed to load one or more JSON files");
                }

                const knowledgeGraph: KnowledgeGraph = await kgRes.json();
                const privacyDfd: PrivacyDfd = await dfdRes.json();
                const renderPlan: RenderPlan = await rpRes.json();

                setData({ knowledgeGraph, privacyDfd, renderPlan });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = (updated: DfdInput) => {
        console.log("✅ Save triggered — updated DFD data:", updated);
        setSavedJson(JSON.stringify({
            knowledge_graph: updated.knowledgeGraph,
            privacy_dfd: updated.privacyDfd,
            dfd_render_plan: updated.renderPlan,
        }, null, 2));
    };

    if (loading) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100vh", background: "#f8fafc",
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: 40, height: 40, border: "4px solid #e2e8f0",
                        borderTopColor: "#3b82f6", borderRadius: "50%",
                        animation: "spin 1s linear infinite", margin: "0 auto 12px",
                    }} />
                    <p style={{ color: "#64748b", fontSize: 14 }}>Loading DFD data…</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100vh", background: "#fef2f2",
            }}>
                <div style={{
                    background: "white", borderRadius: 12, padding: "24px 32px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #fecaca",
                    textAlign: "center", maxWidth: 400,
                }}>
                    <span style={{ fontSize: 32 }}>❌</span>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", margin: "12px 0 8px" }}>
                        Failed to Load
                    </h2>
                    <p style={{ color: "#64748b", fontSize: 13 }}>{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
            {/* Header */}
            <div style={{
                padding: "12px 24px", background: "white",
                borderBottom: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🔀</span>
                    <div>
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
                            DFD Test — Editable Data Flow Diagram
                        </h1>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                            Loaded from knowledge_graph.json + privacy_dfd.json + dfd_render_plan.json
                        </p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    <span style={{
                        background: "#dbeafe", color: "#1d4ed8", borderRadius: 8,
                        padding: "4px 10px", fontWeight: 600
                    }}>
                        {data.knowledgeGraph.nodes.length} nodes
                    </span>
                    <span style={{
                        background: "#dcfce7", color: "#15803d", borderRadius: 8,
                        padding: "4px 10px", fontWeight: 600
                    }}>
                        {data.knowledgeGraph.edges.length} edges
                    </span>
                    <span style={{
                        background: "#fef3c7", color: "#d97706", borderRadius: 8,
                        padding: "4px 10px", fontWeight: 600
                    }}>
                        {data.renderPlan.levels.length} levels
                    </span>
                </div>
            </div>

            {/* DFD Canvas */}
            <div style={{ flex: 1, position: "relative" }}>
                <EditableDfd data={data} onSave={handleSave} />
            </div>

            {/* Saved JSON output */}
            {savedJson && (
                <div style={{
                    position: "fixed", bottom: 16, right: 16, zIndex: 1000,
                    background: "white", borderRadius: 12, padding: 16,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0",
                    maxWidth: 500, maxHeight: 300, overflow: "auto",
                }}>
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 8,
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#16a34a" }}>
                            ✅ Saved JSON Output
                        </span>
                        <button
                            onClick={() => setSavedJson(null)}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: 16, color: "#94a3b8",
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    <pre style={{
                        fontSize: 10, color: "#334155", background: "#f8fafc",
                        borderRadius: 8, padding: 12, overflow: "auto",
                        maxHeight: 220, margin: 0, border: "1px solid #e2e8f0",
                    }}>
                        {savedJson.slice(0, 2000)}
                        {savedJson.length > 2000 && "\n... (truncated)"}
                    </pre>
                </div>
            )}
        </div>
    );
}
