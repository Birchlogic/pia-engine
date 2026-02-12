"use client";

import { useState } from "react";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    type SortingState,
    type ColumnFiltersState,
    type RowSelectionState,
} from "@tanstack/react-table";
import { matrixColumns, type MatrixRow } from "./matrix-columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface DataMatrixTableProps {
    rows: MatrixRow[];
    onRefresh: () => void;
}

export function DataMatrixTable({ rows, onRefresh }: DataMatrixTableProps) {
    const [sorting, setSorting] = useState<SortingState>([
        { id: "riskScore", desc: true },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [globalFilter, setGlobalFilter] = useState("");

    const table = useReactTable({
        data: rows,
        columns: matrixColumns,
        state: { sorting, columnFilters, rowSelection, globalFilter },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: true,
    });

    const selectedIds = Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((idx) => rows[parseInt(idx)]?.id)
        .filter(Boolean);

    const handleBulkAction = async (status: string) => {
        if (selectedIds.length === 0) return;

        const res = await fetch("/api/matrix", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rowIds: selectedIds, status }),
        });

        if (res.ok) {
            toast.success(`${selectedIds.length} rows updated to ${status}`);
            setRowSelection({});
            onRefresh();
        } else {
            toast.error("Failed to update rows");
        }
    };

    // Summary stats
    const avgConfidence =
        rows.length > 0
            ? rows.reduce((s, r) => s + r.confidenceScore, 0) / rows.length
            : 0;
    const highRiskCount = rows.filter((r) => r.riskScore >= 15).length;
    const gapCount = rows.filter((r) => r.gapsFlagged.length > 0).length;

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Total Elements</p>
                        <p className="text-2xl font-bold">{rows.length}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Avg Confidence</p>
                        <p className="text-2xl font-bold">{Math.round(avgConfidence * 100)}%</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">High Risk</p>
                        <p className="text-2xl font-bold text-red-400">{highRiskCount}</p>
                    </CardContent>
                </Card>
                <Card className="py-3">
                    <CardContent className="px-4 py-0">
                        <p className="text-xs text-muted-foreground">Gaps Flagged</p>
                        <p className="text-2xl font-bold text-yellow-400">{gapCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <Input
                        placeholder="Search data elements..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="max-w-xs"
                    />
                    <Select
                        value={(columnFilters.find((f) => f.id === "dataCategory")?.value as string) || "all"}
                        onValueChange={(v) => {
                            setColumnFilters((prev) => {
                                const withoutCat = prev.filter((f) => f.id !== "dataCategory");
                                if (v === "all") return withoutCat;
                                return [...withoutCat, { id: "dataCategory", value: v }];
                            });
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="sensitive_personal">Sensitive Personal</SelectItem>
                            <SelectItem value="non_personal">Non-Personal</SelectItem>
                            <SelectItem value="anonymized">Anonymized</SelectItem>
                            <SelectItem value="pseudonymized">Pseudonymized</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{selectedIds.length} selected</Badge>
                        <Button size="sm" onClick={() => handleBulkAction("approved")}>
                            ✓ Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleBulkAction("under_review")}>
                            Mark for Review
                        </Button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-auto">
                <table className="w-full text-sm">
                    <thead>
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id} className="border-b bg-muted/50">
                                {hg.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap select-none"
                                        style={{ width: header.getSize() }}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1 cursor-pointer">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getIsSorted() === "asc" && " ↑"}
                                            {header.column.getIsSorted() === "desc" && " ↓"}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={matrixColumns.length} className="text-center py-8 text-muted-foreground">
                                    No data elements found
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b hover:bg-muted/30 transition-colors"
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-3 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-muted-foreground">
                Showing {table.getRowModel().rows.length} of {rows.length} data elements.
                Sort by clicking column headers. Select rows for bulk actions.
            </p>
        </div>
    );
}
