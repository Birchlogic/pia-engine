"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* ─────────────────── Types ─────────────────── */

export interface DfdData {
  department?: string;
  version?: string;
  central_process?: string;
  actors?: Actor[];
  dispersal_sinks?: Sink[];
  storage_systems?: StorageSystem[];
  data_flows?: DataFlow[];
  citations?: Citation[];
}

interface Actor {
  id: string;
  name: string;
  type: string;
  color?: string;
  business_processes?: BusinessProcess[];
}

interface BusinessProcess {
  id: string;
  name: string;
  collection_sources?: CollectionSource[];
}

interface CollectionSource {
  name: string;
  data_elements?: string[];
}

interface Sink {
  id: string;
  name: string;
  actor_id?: string;
  color?: string;
}

interface StorageSystem {
  name: string;
  type?: string;
}

interface DataFlow {
  from_id: string;
  to_id: string;
  label?: string;
  color?: string;
}

interface Citation {
  element_id: string;
  source_type: string;
  source_text: string;
  element_name: string;
  source_section: string;
}

/* ─────────────────── Layout constants ─────────────────── */

const COLORS = {
  external: { bg: "#fef9c3", border: "#f59e0b", text: "#92400e", stripe: "#f59e0b" },
  internal: { bg: "#fce7f3", border: "#ec4899", text: "#831843", stripe: "#ec4899" },
  vendor: { bg: "#dcfce7", border: "#22c55e", text: "#14532d", stripe: "#22c55e" },
};

const LAYOUT = {
  labelW: 80,
  sourceZoneX: 100,
  sourceW: 320,
  gapAfterSources: 40,
  centralW: 160,
  centralH: 80,
  gapAfterCentral: 40,
  sinkW: 240,
  gapAfterSinks: 30,
  storageW: 130,
  rowPadY: 20,
  bpCardH: 0,   // computed per BP
  bpGap: 12,
  sinkCardH: 38,
  sinkGap: 10,
  storageCardH: 55,
  storageGap: 10,
  headerH: 80,
};

/* ─────────────────── Canvas helpers ─────────────────── */

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawArrowhead(ctx: CanvasRenderingContext2D, x: number, y: number, fromX: number, fromY: number, size: number, color: string) {
  const angle = Math.atan2(y - fromY, x - fromX);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - Math.PI / 7), y - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x - size * Math.cos(angle + Math.PI / 7), y - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/* ─────────────────── Layout computation ─────────────────── */

interface NodeBox { id: string; x: number; y: number; w: number; h: number; label: string; color?: string; }

function computeLayout(
  ctx: CanvasRenderingContext2D,
  dfd: DfdData,
  canvasW: number
) {
  const actors = dfd.actors || [];
  const sinks = dfd.dispersal_sinks || [];
  const storage = dfd.storage_systems || [];
  const L = LAYOUT;

  // Compute canvas width based on content
  const totalW = L.labelW + L.sourceW + L.gapAfterSources + L.centralW + L.gapAfterCentral + L.sinkW + L.gapAfterSinks + L.storageW + 40;

  // X coordinates for each zone
  const sourceX = L.labelW + 10;
  const centralX = sourceX + L.sourceW + L.gapAfterSources;
  const sinkX = centralX + L.centralW + L.gapAfterCentral;
  const storageX = sinkX + L.sinkW + L.gapAfterSinks;

  // First pass: compute row heights
  const rowData: {
    actor: Actor;
    bpBoxes: NodeBox[];
    sinkBoxes: NodeBox[];
    rowH: number;
  }[] = [];

  let currentY = L.headerH;

  for (let ai = 0; ai < actors.length; ai++) {
    const actor = actors[ai];
    const bps = actor.business_processes || [];
    const actorSinks = sinks.filter(s => s.actor_id ? s.actor_id === actor.id : ai === 0);

    // Measure BP cards
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    const bpBoxes: NodeBox[] = [];
    let bpTotalH = 0;

    for (const bp of bps) {
      let cardH = 32; // title + padding
      if (bp.collection_sources) {
        for (const src of bp.collection_sources) {
          cardH += 22; // source name
          cardH += (src.data_elements?.length || 0) * 14; // elements
          cardH += 8;
        }
      }
      cardH = Math.max(cardH, 60);
      bpBoxes.push({
        id: bp.id,
        x: sourceX,
        y: currentY + L.rowPadY + bpTotalH,
        w: L.sourceW,
        h: cardH,
        label: bp.name,
      });
      bpTotalH += cardH + L.bpGap;
    }

    // Sink cards
    const sinkBoxes: NodeBox[] = [];
    let sinkTotalH = 0;
    for (const sink of actorSinks) {
      sinkBoxes.push({
        id: sink.id,
        x: sinkX,
        y: currentY + L.rowPadY + sinkTotalH,
        w: L.sinkW,
        h: L.sinkCardH,
        label: sink.name,
        color: sink.color,
      });
      sinkTotalH += L.sinkCardH + L.sinkGap;
    }

    const rowH = Math.max(bpTotalH, sinkTotalH, 100) + L.rowPadY * 2;

    rowData.push({ actor, bpBoxes, sinkBoxes, rowH });
    currentY += rowH;
  }

  const totalH = currentY + 10;

  // Center sinks vertically in their rows
  for (const row of rowData) {
    const sinkTotalH = row.sinkBoxes.length * (L.sinkCardH + L.sinkGap) - L.sinkGap;
    const rowTop = row.bpBoxes[0]?.y ?? 0;
    const sinkStartY = rowTop + (row.rowH - L.rowPadY * 2 - sinkTotalH) / 2;
    row.sinkBoxes.forEach((s, i) => {
      s.y = sinkStartY + i * (L.sinkCardH + L.sinkGap);
    });
  }

  // Central process — centered vertically across ALL rows
  const centralY = L.headerH + (totalH - L.headerH - L.centralH) / 2;
  const centralBox: NodeBox = {
    id: "central_process",
    x: centralX,
    y: centralY,
    w: L.centralW,
    h: L.centralH,
    label: dfd.central_process || "Central Process",
  };

  // Storage — spread in the right column
  const storageBoxes: NodeBox[] = [];
  const storageTotalH = storage.length * (L.storageCardH + L.storageGap);
  const storageStartY = L.headerH + (totalH - L.headerH - storageTotalH) / 2;
  storage.forEach((sys, i) => {
    storageBoxes.push({
      id: `storage_${i}`,
      x: storageX,
      y: storageStartY + i * (L.storageCardH + L.storageGap),
      w: L.storageW,
      h: L.storageCardH,
      label: sys.name,
      color: sys.type === "cloud" ? "#3b82f6" : "#64748b",
    });
  });

  return { rowData, centralBox, storageBoxes, totalW, totalH };
}

/* ─────────────────── Main render function ─────────────────── */

function renderDfd(canvas: HTMLCanvasElement, dfd: DfdData) {
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Temp layout pass
  canvas.width = 2000;
  canvas.height = 3000;
  ctx.scale(dpr, dpr);

  const layout = computeLayout(ctx, dfd, 1200);
  const { rowData, centralBox, storageBoxes, totalW, totalH } = layout;
  const L = LAYOUT;

  // Set final canvas size
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = `${totalW}px`;
  canvas.style.height = `${totalH}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, totalW, totalH);

  // ── Background ──
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, totalW, totalH);

  // ── Header ──
  const grad = ctx.createLinearGradient(0, 0, totalW, 0);
  grad.addColorStop(0, "#1e293b");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, totalW, L.headerH);

  // Department name
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 16px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(dfd.department || "Department", totalW / 2, 22);

  // Column headers
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  const colHeaders = [
    { label: "DATA COLLECTION", x: L.labelW + 10 + L.sourceW / 2 },
    { label: "DATA PROCESSING", x: centralBox.x + centralBox.w / 2 },
    { label: "DATA DISPERSAL", x: rowData[0]?.sinkBoxes[0]?.x ? rowData[0].sinkBoxes[0].x + L.sinkW / 2 : centralBox.x + centralBox.w + L.gapAfterCentral + L.sinkW / 2 },
    { label: "STORAGE", x: storageBoxes[0]?.x ? storageBoxes[0].x + L.storageW / 2 : totalW - L.storageW / 2 - 20 },
  ];
  for (const h of colHeaders) {
    ctx.fillText(h.label, h.x, 50);
  }

  // Header separator
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, L.headerH);
  ctx.lineTo(totalW, L.headerH);
  ctx.stroke();

  // ── Thin column divider lines ──
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (const x of [L.labelW, L.labelW + L.sourceW + 20, centralBox.x + centralBox.w + 20, storageBoxes[0]?.x ? storageBoxes[0].x - 15 : totalW - L.storageW - 40]) {
    ctx.beginPath();
    ctx.moveTo(x, L.headerH);
    ctx.lineTo(x, totalH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Actor swimlane rows ──
  let drawY = L.headerH;
  for (const row of rowData) {
    const colors = COLORS[row.actor.type as keyof typeof COLORS] || COLORS.external;

    // Row background
    ctx.fillStyle = colors.bg + "0d"; // very subtle
    ctx.fillRect(0, drawY, totalW, row.rowH);

    // Actor stripe on left
    ctx.fillStyle = colors.stripe;
    ctx.fillRect(0, drawY, 4, row.rowH);

    // Actor label (vertical)
    ctx.save();
    ctx.translate(42, drawY + row.rowH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = colors.stripe;
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "3px";
    ctx.fillText(row.actor.name.toUpperCase(), 0, 0);
    ctx.letterSpacing = "0px";
    ctx.restore();

    // Row bottom border
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, drawY + row.rowH);
    ctx.lineTo(totalW, drawY + row.rowH);
    ctx.stroke();

    // ── Business Process cards ──
    for (const bp of row.bpBoxes) {
      // Card shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundRect(ctx, bp.x + 2, bp.y + 2, bp.w, bp.h, 8);
      ctx.fill();

      // Card bg
      ctx.fillStyle = "#1e293b";
      roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 8);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      roundRect(ctx, bp.x, bp.y, bp.w, bp.h, 8);
      ctx.stroke();

      // BP title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(bp.label, bp.x + 12, bp.y + 10);

      // Dashed separator
      ctx.strokeStyle = "#475569";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(bp.x + 12, bp.y + 26);
      ctx.lineTo(bp.x + bp.w - 12, bp.y + 26);
      ctx.stroke();
      ctx.setLineDash([]);

      // Collection sources
      const actor = row.actor;
      const bpData = actor.business_processes?.find(b => b.id === bp.id);
      let srcOffY = bp.y + 32;
      if (bpData?.collection_sources) {
        for (const src of bpData.collection_sources) {
          ctx.fillStyle = "#93c5fd";
          ctx.font = "600 10px Inter, system-ui, sans-serif";
          ctx.fillText(src.name, bp.x + 16, srcOffY);
          srcOffY += 16;

          if (src.data_elements) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "400 9px Inter, system-ui, sans-serif";
            for (const el of src.data_elements) {
              ctx.fillText(`• ${el}`, bp.x + 24, srcOffY);
              srcOffY += 14;
            }
          }
          srcOffY += 4;
        }
      }
    }

    // ── Sink cards ──
    for (const sink of row.sinkBoxes) {
      const sinkColor = sink.color || "#64748b";

      // Card shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      roundRect(ctx, sink.x + 1, sink.y + 1, sink.w, sink.h, 8);
      ctx.fill();

      // Card bg
      ctx.fillStyle = "#1e293b";
      roundRect(ctx, sink.x, sink.y, sink.w, sink.h, 8);
      ctx.fill();

      // Left color stripe
      ctx.fillStyle = sinkColor;
      ctx.beginPath();
      ctx.roundRect(sink.x, sink.y, 5, sink.h, [8, 0, 0, 8]);
      ctx.fill();

      // Border
      ctx.strokeStyle = sinkColor + "40";
      ctx.lineWidth = 1;
      roundRect(ctx, sink.x, sink.y, sink.w, sink.h, 8);
      ctx.stroke();

      // Icon
      const icon = getSinkIcon(sink.label);
      ctx.font = "14px serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, sink.x + 14, sink.y + sink.h / 2);

      // Label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.fillText(sink.label, sink.x + 34, sink.y + sink.h / 2 + 1);
    }

    drawY += row.rowH;
  }

  // ── Central process box ──
  // Glow
  ctx.shadowColor = "#3b82f6";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const cgrd = ctx.createLinearGradient(centralBox.x, centralBox.y, centralBox.x, centralBox.y + centralBox.h);
  cgrd.addColorStop(0, "#2563eb");
  cgrd.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = cgrd;
  roundRect(ctx, centralBox.x, centralBox.y, centralBox.w, centralBox.h, 12);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 1.5;
  roundRect(ctx, centralBox.x, centralBox.y, centralBox.w, centralBox.h, 12);
  ctx.stroke();

  // Label
  ctx.fillStyle = "#93c5fd";
  ctx.font = "600 8px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PROCESS", centralBox.x + centralBox.w / 2, centralBox.y + 20);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px Inter, system-ui, sans-serif";
  const centralLines = wrapText(ctx, centralBox.label, centralBox.w - 20);
  centralLines.forEach((line, i) => {
    ctx.fillText(line, centralBox.x + centralBox.w / 2, centralBox.y + 40 + i * 16);
  });

  // ── Storage boxes ──
  for (const stor of storageBoxes) {
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, stor.x, stor.y, stor.w, stor.h, 8);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    roundRect(ctx, stor.x, stor.y, stor.w, stor.h, 8);
    ctx.stroke();

    // Cloud/server icon
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stor.color === "#3b82f6" ? "☁️" : "🗄️", stor.x + stor.w / 2, stor.y + 18);

    // Name
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 9px Inter, system-ui, sans-serif";
    const nameLines = wrapText(ctx, stor.label, stor.w - 10);
    nameLines.forEach((line, i) => {
      ctx.fillText(line, stor.x + stor.w / 2, stor.y + 36 + i * 12);
    });
  }

  // ── ARROWS ──
  const flows = dfd.data_flows || [];
  const allBpBoxes = rowData.flatMap(r => r.bpBoxes);
  const allSinkBoxes = rowData.flatMap(r => r.sinkBoxes);

  // Index boxes by ID
  const bpById = new Map(allBpBoxes.map(b => [b.id, b]));
  const sinkById = new Map(allSinkBoxes.map(s => [s.id, s]));

  // Inbound flows (bp → central)
  const inbound = flows.filter(f => f.to_id === "central_process");
  inbound.forEach((flow, idx) => {
    const bp = bpById.get(flow.from_id);
    if (!bp) return;
    const color = flow.color || "#64748b";

    const x1 = bp.x + bp.w;
    const y1 = bp.y + bp.h / 2;
    const entryFrac = (idx + 1) / (inbound.length + 1);
    const x2 = centralBox.x;
    const y2 = centralBox.y + centralBox.h * entryFrac;

    // Bezier from bp right edge → central left edge
    const cp1x = x1 + (x2 - x1) * 0.5;
    const cp1y = y1;
    const cp2x = x2 - (x2 - x1) * 0.3;
    const cp2y = y2;

    // Shadow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.strokeStyle = color + "15";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead
    drawArrowhead(ctx, x2, y2, cp2x, cp2y, 8, color);

    // Label near source
    if (flow.label) {
      const lx = x1 + (x2 - x1) * 0.35;
      const ly = y1 + (y2 - y1) * 0.25 - 10;
      drawFlowLabel(ctx, flow.label, lx, ly, color);
    }
  });

  // Outbound flows (central → sink)
  const outbound = flows.filter(f => f.from_id === "central_process");
  outbound.forEach((flow, idx) => {
    const sink = sinkById.get(flow.to_id);
    if (!sink) return;
    const color = flow.color || "#64748b";

    const exitFrac = (idx + 1) / (outbound.length + 1);
    const x1 = centralBox.x + centralBox.w;
    const y1 = centralBox.y + centralBox.h * exitFrac;
    const x2 = sink.x;
    const y2 = sink.y + sink.h / 2;

    const cp1x = x1 + (x2 - x1) * 0.4;
    const cp1y = y1;
    const cp2x = x2 - (x2 - x1) * 0.35;
    const cp2y = y2;

    // Shadow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.strokeStyle = color + "15";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Main
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead
    drawArrowhead(ctx, x2, y2, cp2x, cp2y, 8, color);

    // Label near sink
    if (flow.label) {
      const lx = x1 + (x2 - x1) * 0.6;
      const ly = y2 - 12;
      drawFlowLabel(ctx, flow.label, lx, ly, color);
    }
  });

  // Direct flows (bp → sink, bypass central)
  const direct = flows.filter(f => f.from_id !== "central_process" && f.to_id !== "central_process");
  direct.forEach((flow, idx) => {
    const bp = bpById.get(flow.from_id);
    const sink = sinkById.get(flow.to_id);
    if (!bp || !sink) return;
    const color = flow.color || "#64748b";

    const x1 = bp.x + bp.w;
    const y1 = bp.y + bp.h / 2;
    const x2 = sink.x;
    const y2 = sink.y + sink.h / 2;

    // Route below central box
    const arcY = Math.max(centralBox.y + centralBox.h + 40 + idx * 25, Math.max(y1, y2) + 30);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + 50, arcY, x2 - 50, arcY, x2, y2);
    ctx.strokeStyle = color + "15";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + 50, arcY, x2 - 50, arcY, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawArrowhead(ctx, x2, y2, x2 - 50, arcY, 8, color);

    if (flow.label) {
      drawFlowLabel(ctx, flow.label, (x1 + x2) / 2, arcY - 8, color);
    }
  });
}

function getSinkIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sales")) return "💼";
  if (n.includes("retention")) return "🔄";
  if (n.includes("compliance") || n.includes("ethics")) return "⚖️";
  if (n.includes("audit") || n.includes("fraud")) return "🛡️";
  if (n.includes("operations") || n.includes("loan")) return "⚙️";
  if (n.includes("legal")) return "📜";
  if (n.includes("collections")) return "💰";
  return "➡️";
}

function drawFlowLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  ctx.font = "600 8px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(label).width + 10;
  const th = 16;

  // Pill background
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(x - tw / 2, y - th / 2, tw, th, 4);
  ctx.fill();

  ctx.strokeStyle = color + "80";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(x - tw / 2, y - th / 2, tw, th, 4);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

/* ─────────────────── React Component ─────────────────── */

export function DfdHtmlRenderer({ dfd }: { dfd: DfdData | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!canvasRef.current || !dfd) return;
    renderDfd(canvasRef.current, dfd);
  }, [dfd]);

  useEffect(() => {
    const t1 = setTimeout(render, 100);
    const t2 = setTimeout(render, 500);
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", onResize); };
  }, [render]);

  if (!dfd) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          No DFD data available
        </CardContent>
      </Card>
    );
  }

  const citations = dfd.citations || [];
  const version = dfd.version || "1.0";

  return (
    <div className="space-y-0">
      {/* Toolbar above canvas */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">Data Flow Diagram</h3>
          <Badge variant="outline" className="text-[10px] font-mono">v{version}</Badge>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              📋 Sources
              <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {citations.length}
              </Badge>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Source Citations</SheetTitle>
              <SheetDescription>
                Evidence and references backing each DFD element.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              {citations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No citations available.
                </p>
              ) : (
                citations.map((cite, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-3 flex gap-3">
                      <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0 text-[10px]">
                        {i + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs">{cite.element_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                          {cite.source_section}
                        </p>
                        <blockquote className="text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2.5 py-1 bg-muted/30 rounded-r leading-relaxed">
                          &ldquo;{cite.source_text}&rdquo;
                        </blockquote>
                        <Badge variant="secondary" className="mt-2 text-[9px]">
                          {cite.source_type === "docx_table" ? "📄 Document" : "🔍 Inferred"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Canvas container */}
      <Card className="overflow-hidden border-border/60">
        <div ref={containerRef} className="overflow-x-auto bg-[#0f172a] rounded-lg">
          <canvas ref={canvasRef} className="block" />
        </div>
      </Card>
    </div>
  );
}
