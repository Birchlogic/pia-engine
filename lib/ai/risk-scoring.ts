import type { ClassifiedDataElement, RiskFactors } from "./schemas";

/**
 * Step 4: Deterministic risk scoring.
 *
 * Risk Score = ceil((S × P × V × E) / 25) mapped to 1-25 scale
 *
 * All scoring is rule-based, no LLM needed.
 */
export function computeRiskScore(element: ClassifiedDataElement): RiskFactors {
    const sensitivity = getSensitivityWeight(element);
    const processing = getProcessingRisk(element);
    const volume = getVolumeIndicator(element);
    const exposure = getExposureFactor(element);

    const raw = (sensitivity * processing * volume * exposure) / 25;
    const finalScore = Math.min(25, Math.max(1, Math.ceil(raw)));

    return {
        sensitivity_weight: sensitivity,
        processing_risk: processing,
        volume_indicator: volume,
        exposure_factor: exposure,
        final_score: finalScore,
    };
}

function getSensitivityWeight(el: ClassifiedDataElement): number {
    switch (el.data_category) {
        case "non_personal":
        case "anonymized":
            return 1;
        case "pseudonymized":
            return 2;
        case "personal":
            return 3;
        case "sensitive_personal": {
            // Check for special categories
            const sub = (el.data_sub_category ?? "").toLowerCase();
            if (["biometric", "genetic", "children", "criminal", "health"].some((k) => sub.includes(k))) {
                return 5;
            }
            return 4;
        }
        default:
            return 3;
    }
}

function getProcessingRisk(el: ClassifiedDataElement): number {
    const types = el.processing_types.map((t) => t.toLowerCase());
    const hasExternal = el.data_recipients_external.length > 0;
    const hasAutomated = types.some((t) =>
        ["profiling", "automated_decision", "automated decision-making"].some((k) => t.includes(k))
    );

    if (hasAutomated && hasExternal) return 5;
    if (hasExternal) return 4;
    if (hasAutomated || types.some((t) => t.includes("profiling"))) return 3;
    if (types.some((t) => ["transfer", "sharing", "processing"].some((k) => t.includes(k)))) return 2;
    return 1;
}

function getVolumeIndicator(el: ClassifiedDataElement): number {
    const subjects = el.data_subjects.map((s) => s.toLowerCase()).join(" ");
    if (subjects.includes("all") || subjects.includes("public") || subjects.includes("citizen")) return 5;
    if (subjects.includes("customer") || subjects.includes("user")) return 4;
    if (subjects.includes("employee") || subjects.includes("staff")) return 3;
    if (subjects.includes("contractor") || subjects.includes("vendor")) return 2;
    return 2; // Default moderate
}

function getExposureFactor(el: ClassifiedDataElement): number {
    let score = 1;

    if (el.cross_border_transfer) score += 2;
    if (el.encryption_at_rest === "no" || el.encryption_in_transit === "no") score += 1;
    if (el.encryption_at_rest === "unknown" || el.encryption_in_transit === "unknown") score += 1;
    if (!el.retention_period || el.retention_compliant === false) score += 1;
    if (el.data_recipients_external.length > 1) score += 1;

    return Math.min(5, score);
}
