"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ──

export type MermaidDFDData = {
    id: string;
    status: string;
    createdAt: string;
    mermaidCode: string;
    summary: string | null;
    nodeCount: number;
    edgeCount: number;
    highRiskFlows: string[];
    crossBorderFlows: string[];
    unencryptedFlows: string[];
};

interface MermaidDFDViewerProps {
    graph: MermaidDFDData;
}

// ── Component ──

export function MermaidDFDViewer({ graph }: MermaidDFDViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>("");
    const [renderError, setRenderError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    // Initialize mermaid and render
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            flowchart: {
                htmlLabels: true,
                curve: "basis",
                padding: 20,
                nodeSpacing: 50,
                rankSpacing: 80,
                useMaxWidth: false,
            },
            themeVariables: {
                primaryColor: "#3b82f6",
                primaryTextColor: "#f8fafc",
                primaryBorderColor: "#60a5fa",
                lineColor: "#94a3b8",
                secondaryColor: "#1e293b",
                tertiaryColor: "#0f172a",
                background: "#0a0a0a",
                mainBkg: "#1e293b",
                nodeBorder: "#475569",
                clusterBkg: "#1e293b",
                clusterBorder: "#334155",
                titleColor: "#f8fafc",
                edgeLabelBackground: "#1e293b",
                nodeTextColor: "#f8fafc",
            },
        });

        const renderDiagram = async () => {
            try {
                setRenderError(null);
                const uniqueId = `mermaid-dfd-${Date.now()}`;
                const { svg } = await mermaid.render(uniqueId, graph.mermaidCode);
                setSvgContent(svg);
            } catch (err) {
                console.error("Mermaid render error:", err);
                setRenderError(
                    err instanceof Error ? err.message : "Failed to render diagram"
                );
            }
        };

        if (graph.mermaidCode) {
            renderDiagram();
        }
    }, [graph.mermaidCode]);

    // Zoom handlers
    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.2));
    const handleZoomReset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            });
        }
    }, [isPanning, panStart]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Scroll to zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
    }, []);

    // Copy mermaid code
    const handleCopyCode = async () => {
        await navigator.clipboard.writeText(graph.mermaidCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Download SVG
    const handleDownloadSVG = () => {
        if (!svgContent) return;
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dfd-${graph.id}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-5 gap-3">
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Nodes</p>
                        <p className="text-2xl font-bold">{graph.nodeCount}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Data Flows</p>
                        <p className="text-2xl font-bold">{graph.edgeCount}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">High Risk</p>
                        <p className="text-2xl font-bold text-red-400">
                            {graph.highRiskFlows.length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Cross-Border</p>
                        <p className="text-2xl font-bold text-orange-400">
                            {graph.crossBorderFlows.length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Unencrypted</p>
                        <p className="text-2xl font-bold text-yellow-400">
                            {graph.unencryptedFlows.length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Summary description */}
            {graph.summary && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-3 px-4">
                        <p className="text-sm text-muted-foreground">{graph.summary}</p>
                    </CardContent>
                </Card>
            )}

            {/* Risk insights */}
            {(graph.highRiskFlows.length > 0 ||
                graph.crossBorderFlows.length > 0 ||
                graph.unencryptedFlows.length > 0) && (
                <div className="grid grid-cols-3 gap-3">
                    {graph.highRiskFlows.length > 0 && (
                        <Card className="border-red-500/20">
                            <CardContent className="py-3 px-4">
                                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                                    High Risk Flows
                                </p>
                                <ul className="space-y-1">
                                    {graph.highRiskFlows.map((flow, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                                        >
                                            <span className="text-red-400 mt-0.5">&#x2022;</span>
                                            {flow}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {graph.crossBorderFlows.length > 0 && (
                        <Card className="border-orange-500/20">
                            <CardContent className="py-3 px-4">
                                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">
                                    Cross-Border Flows
                                </p>
                                <ul className="space-y-1">
                                    {graph.crossBorderFlows.map((flow, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                                        >
                                            <span className="text-orange-400 mt-0.5">&#x2022;</span>
                                            {flow}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {graph.unencryptedFlows.length > 0 && (
                        <Card className="border-yellow-500/20">
                            <CardContent className="py-3 px-4">
                                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                                    Unencrypted Flows
                                </p>
                                <ul className="space-y-1">
                                    {graph.unencryptedFlows.map((flow, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                                        >
                                            <span className="text-yellow-400 mt-0.5">&#x2022;</span>
                                            {flow}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" x2="16.65" y1="21" y2="16.65" />
                                    <line x1="8" x2="14" y1="11" y2="11" />
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zoom Out</TooltipContent>
                    </Tooltip>

                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">
                        {Math.round(zoom * 100)}%
                    </span>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" x2="16.65" y1="21" y2="16.65" />
                                    <line x1="11" x2="11" y1="8" y2="14" />
                                    <line x1="8" x2="14" y1="11" y2="11" />
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zoom In</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomReset}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                    <path d="M21 3v5h-5" />
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset View</TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                        {graph.status}
                    </Badge>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCode(!showCode)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                    <polyline points="16 18 22 12 16 6" />
                                    <polyline points="8 6 2 12 8 18" />
                                </svg>
                                {showCode ? "Hide Code" : "View Code"}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Toggle Mermaid source code</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopyCode}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                                {copied ? "Copied!" : "Copy Code"}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy Mermaid code to clipboard</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownloadSVG} disabled={!svgContent}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                                Download SVG
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download diagram as SVG</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Mermaid code panel (collapsible) */}
            {showCode && (
                <Card className="bg-muted/30 border-border/50">
                    <CardContent className="p-4">
                        <pre className="text-xs font-mono text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto whitespace-pre leading-relaxed">
                            {graph.mermaidCode}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Diagram canvas */}
            {renderError ? (
                <Card className="border-destructive/50">
                    <CardContent className="py-8 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-destructive">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" x2="12" y1="8" y2="12" />
                                <line x1="12" x2="12.01" y1="16" y2="16" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold mb-1">Diagram Render Error</h3>
                        <p className="text-xs text-muted-foreground text-center max-w-md mb-3">
                            {renderError}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Try regenerating the DFD or view the raw Mermaid code above.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div
                    className="rounded-lg border bg-background overflow-hidden cursor-grab active:cursor-grabbing"
                    style={{ height: 650 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <div
                        ref={containerRef}
                        className="w-full h-full flex items-center justify-center [&_svg]:max-w-none"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: "center center",
                            transition: isPanning ? "none" : "transform 0.15s ease-out",
                        }}
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                    />
                </div>
            )}
        </div>
    );
}
