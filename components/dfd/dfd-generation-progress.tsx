"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type ProgressEvent = {
    step: string;
    message: string;
    progress: number;
    detail?: string;
};

const stepLabels: Record<string, string> = {
    loading: "Loading Data",
    generating_mermaid: "Generating DFD",
    persisting: "Saving Results",
    done: "Complete",
    error: "Error",
};

const stepOrder = [
    "loading",
    "generating_mermaid",
    "persisting",
    "done",
];

interface DFDGenerationProgressProps {
    jobId: string;
    onComplete: () => void;
    onError: (message: string) => void;
}

export function DFDGenerationProgress({ jobId, onComplete, onError }: DFDGenerationProgressProps) {
    const [currentStep, setCurrentStep] = useState<string>("loading");
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState("Starting DFD generation...");

    useEffect(() => {
        const eventSource = new EventSource(
            `/api/ai/generate-dfd/progress?jobId=${encodeURIComponent(jobId)}`
        );

        eventSource.onmessage = (e) => {
            try {
                const event: ProgressEvent = JSON.parse(e.data);
                setCurrentStep(event.step);
                setProgress(event.progress);
                setMessage(event.message);

                if (event.step === "done") {
                    eventSource.close();
                    setTimeout(() => onComplete(), 500);
                }
                if (event.step === "error") {
                    eventSource.close();
                    onError(event.message);
                }
            } catch {
                // Skip malformed events
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [jobId]);

    const activeStepIndex = stepOrder.indexOf(currentStep);

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Generating Data Flow Diagram</h3>
                        <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    </div>
                    <div className="text-2xl font-bold text-primary tabular-nums">
                        {progress > 0 ? `${progress}%` : "..."}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(2, progress)}%` }}
                    />
                </div>

                {/* Step indicators */}
                <div className="grid grid-cols-4 gap-1">
                    {stepOrder.map((step, idx) => {
                        const isDone = idx < activeStepIndex || currentStep === "done";
                        const isActive = step === currentStep && currentStep !== "done";

                        return (
                            <div key={step} className="flex flex-col items-center gap-1">
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${isDone
                                            ? "bg-primary text-primary-foreground"
                                            : isActive
                                                ? "bg-primary/30 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    {isDone ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : isActive ? (
                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                    ) : (
                                        idx + 1
                                    )}
                                </div>
                                <span className={`text-[10px] text-center leading-tight ${isDone || isActive ? "text-foreground" : "text-muted-foreground"
                                    }`}>
                                    {stepLabels[step] || step}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
