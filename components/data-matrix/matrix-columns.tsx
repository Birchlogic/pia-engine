"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export type MatrixRow = {
    id: string;
    dataElementName: string;
    dataCategory: string;
    dataSubCategory: string | null;
    dataSubjects: string[];
    sourceOfData: string;
    collectionMethod: string;
    purposeOfProcessing: string;
    legalBasis: string;
    processingTypes: string[];
    systemsApplications: string[];
    storageLocation: string;
    encryptionAtRest: string;
    encryptionInTransit: string;
    retentionPeriod: string | null;
    dataRecipientsInternal: string[];
    dataRecipientsExternal: string[];
    crossBorderTransfer: boolean;
    dataOwner: string;
    riskScore: number;
    confidenceScore: number;
    gapsFlagged: string[];
    status: string;
};

function ConfidenceBar({ score }: { score: number }) {
    const pct = Math.round(score * 100);
    let color = "bg-green-500";
    if (score < 0.5) color = "bg-red-500";
    else if (score < 0.8) color = "bg-yellow-500";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                </div>
            </TooltipTrigger>
            <TooltipContent>Confidence: {pct}%</TooltipContent>
        </Tooltip>
    );
}

function RiskBadge({ score }: { score: number }) {
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let label = "Low";
    if (score >= 20) {
        variant = "destructive";
        label = "Critical";
    } else if (score >= 15) {
        variant = "destructive";
        label = "High";
    } else if (score >= 8) {
        variant = "default";
        label = "Medium";
    }
    return (
        <Badge variant={variant} className="text-xs font-mono tabular-nums">
            {score} — {label}
        </Badge>
    );
}

function GapIndicator({ gaps }: { gaps: string[] }) {
    if (gaps.length === 0) return null;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-yellow-500">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                    </svg>
                    <span className="text-xs text-yellow-500">{gaps.length}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                <p className="font-medium text-sm mb-1">Gaps Flagged:</p>
                <ul className="text-xs space-y-1">
                    {gaps.map((g, i) => (
                        <li key={i}>• {g}</li>
                    ))}
                </ul>
            </TooltipContent>
        </Tooltip>
    );
}

const categoryColors: Record<string, string> = {
    personal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    sensitive_personal: "bg-red-500/20 text-red-400 border-red-500/30",
    non_personal: "bg-green-500/20 text-green-400 border-green-500/30",
    anonymized: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    pseudonymized: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export const matrixColumns: ColumnDef<MatrixRow>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 32,
    },
    {
        accessorKey: "dataElementName",
        header: "Data Element",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <span className="font-medium">{row.original.dataElementName}</span>
                <GapIndicator gaps={row.original.gapsFlagged} />
            </div>
        ),
        size: 220,
    },
    {
        accessorKey: "dataCategory",
        header: "Category",
        cell: ({ row }) => {
            const cat = row.original.dataCategory;
            const cls = categoryColors[cat] || "";
            return (
                <Badge variant="outline" className={`text-xs ${cls}`}>
                    {cat.replace(/_/g, " ")}
                </Badge>
            );
        },
        size: 130,
    },
    {
        accessorKey: "dataSubjects",
        header: "Data Subjects",
        cell: ({ row }) => (
            <div className="flex gap-1 flex-wrap">
                {row.original.dataSubjects.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                    </Badge>
                ))}
            </div>
        ),
        size: 160,
    },
    {
        accessorKey: "purposeOfProcessing",
        header: "Purpose",
        cell: ({ row }) => (
            <span className="text-sm line-clamp-2">{row.original.purposeOfProcessing}</span>
        ),
        size: 200,
    },
    {
        accessorKey: "systemsApplications",
        header: "Systems",
        cell: ({ row }) => (
            <div className="flex gap-1 flex-wrap">
                {row.original.systemsApplications.slice(0, 2).map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                        {s}
                    </Badge>
                ))}
                {row.original.systemsApplications.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                        +{row.original.systemsApplications.length - 2}
                    </Badge>
                )}
            </div>
        ),
        size: 160,
    },
    {
        accessorKey: "riskScore",
        header: "Risk",
        cell: ({ row }) => <RiskBadge score={row.original.riskScore} />,
        size: 120,
    },
    {
        accessorKey: "confidenceScore",
        header: "Confidence",
        cell: ({ row }) => <ConfidenceBar score={row.original.confidenceScore} />,
        size: 130,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const s = row.original.status;
            return (
                <Badge
                    variant={s === "approved" ? "default" : s === "under_review" ? "secondary" : "outline"}
                    className="text-xs"
                >
                    {s === "approved" ? "✓ Approved" : s === "under_review" ? "Under Review" : "Draft"}
                </Badge>
            );
        },
        size: 110,
    },
];
