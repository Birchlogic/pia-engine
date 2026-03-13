"use client";

import { useState } from "react";
import { 
    CheckCircle2, 
    Circle, 
    Loader2, 
    ChevronDown, 
    ChevronUp,
    Info,
    Layout
} from "lucide-react";
import { 
    Collapsible, 
    CollapsibleContent, 
    CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
    Sheet, 
    SheetContent, 
    SheetDescription, 
    SheetHeader, 
    SheetTitle 
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface PipelineStage {
    stage: string;
    stage_order: number;
    output: any;
    duration_ms: number;
    in_tokens?: number;
    out_tokens?: number;
    created_at: string;
}

export interface PipelineStatusResponse {
    session_id: string;
    status: string;
    current_stage: string;
    progress_percent: number;
    stages: PipelineStage[];
}

interface PipelineStageTrackerProps {
    data: PipelineStatusResponse | null;
}

export function PipelineStageTracker({ data }: PipelineStageTrackerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);

    if (!data) return null;

    const { status, current_stage, progress_percent, stages } = data;
    const stageList = stages || [];
    const isCompleted = status === "completed";
    const isFailed = status === "failed";

    return (
        <div className="w-full space-y-4">
            {/* Summary View */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            isCompleted ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : 
                            "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        )}>
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">
                                {isCompleted ? "Processing Completed" : `Currently: ${current_stage.replace(/_/g, " ")}`}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {isCompleted ? "All stages finished successfully" : "DPIP Pipeline is running..."}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-foreground">{progress_percent}%</span>
                        {isFailed && <Badge variant="destructive" className="ml-2">Failed</Badge>}
                    </div>
                </div>
                
                <Progress value={progress_percent} className="h-2 mb-2" />

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
                    <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-center w-full gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all border border-transparent hover:border-border">
                            {isOpen ? "Hide Details" : "Show Stages"}
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="pt-2">
                        <div className="relative pl-6 space-y-2 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                            {stageList.map((stage, idx) => {
                                const isStageCompleted = idx < stageList.length - 1 || isCompleted;
                                const isCurrent = stage.stage === current_stage && !isCompleted;

                                return (
                                    <div 
                                        key={`${stage.stage}-${idx}`}
                                        className="relative group pr-2"
                                    >
                                        <div className={cn(
                                            "absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-card flex items-center justify-center z-10 transition-colors",
                                            isStageCompleted ? "border-green-500 bg-green-50 dark:bg-green-900/10" : 
                                            isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-border bg-card"
                                        )}>
                                            {isStageCompleted ? (
                                                <CheckCircle2 className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                                            ) : isCurrent ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                                            ) : (
                                                <Circle className="w-2.5 h-2.5 text-muted-foreground/30" />
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center justify-between py-1.5 px-3 rounded-lg border border-transparent transition-all">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className={cn(
                                                        "text-sm font-medium transition-colors truncate",
                                                        isStageCompleted ? "text-foreground/80" : isCurrent ? "text-primary/90" : "text-muted-foreground/60"
                                                    )}>
                                                        {stage.stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                                    </h4>
                                                    {(stage.in_tokens !== undefined || stage.out_tokens !== undefined) && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-medium">
                                                            <span className="bg-muted/50 px-1 rounded">In: {stage.in_tokens || 0}</span>
                                                            <span className="bg-muted/50 px-1 rounded">Out: {stage.out_tokens || 0}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground/50 font-mono">
                                                    {stage.duration_ms > 0 ? `${(stage.duration_ms / 1000).toFixed(2)}s` : "Pending..."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}
