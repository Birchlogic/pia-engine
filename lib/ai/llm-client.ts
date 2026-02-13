import { z } from "zod";

type LLMProvider = "anthropic" | "openai";

interface LLMCallOptions<T extends z.ZodTypeAny> {
    prompt: string;
    schema: T;
    model?: string;
    maxRetries?: number;
    temperature?: number;
}

function getProvider(): LLMProvider {
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY) return "openai";
    throw new Error(
        "No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local"
    );
}

async function callAnthropic(prompt: string, model: string, temperature: number): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            temperature,
            messages: [
                {
                    role: "user",
                    content: prompt + "\n\nIMPORTANT: Return ONLY valid JSON, no markdown, no explanation, no code fences.",
                },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.content[0].text;
}

async function callOpenAI(prompt: string, model: string, temperature: number): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        },
        body: JSON.stringify({
            model,
            temperature,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "You are a privacy assessment analyst. Always respond with valid JSON only.",
                },
                { role: "user", content: prompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

function extractJSON(raw: string): string {
    // Strip markdown code fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();

    // Try to find JSON object boundaries
    const objStart = raw.indexOf("{");
    const objEnd = raw.lastIndexOf("}");

    // Try to find JSON array boundaries
    const arrStart = raw.indexOf("[");
    const arrEnd = raw.lastIndexOf("]");

    // Pick whichever comes first (object or array)
    const hasObj = objStart !== -1 && objEnd !== -1 && objEnd > objStart;
    const hasArr = arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart;

    if (hasObj && hasArr) {
        // Use whichever starts first
        if (arrStart < objStart) {
            return raw.slice(arrStart, arrEnd + 1);
        }
        return raw.slice(objStart, objEnd + 1);
    }
    if (hasObj) return raw.slice(objStart, objEnd + 1);
    if (hasArr) return raw.slice(arrStart, arrEnd + 1);

    return raw.trim();
}

/**
 * Normalize LLM output to fix common field name / type mismatches
 * before Zod validation. LLMs frequently:
 * - Use alternate field names (e.g. "name" instead of "data_element")
 * - Return booleans as strings ("true" instead of true)
 * - Return objects as strings when null is expected
 */
function normalizeLLMOutput(parsed: unknown): unknown {
    if (!parsed || typeof parsed !== "object") return parsed;

    const obj = parsed as Record<string, unknown>;

    // Normalize data_elements array (Step 2: Relationship Graph)
    if (Array.isArray(obj.data_elements)) {
        obj.data_elements = obj.data_elements.map((el: unknown) => {
            if (!el || typeof el !== "object") return el;
            const elem = el as Record<string, unknown>;

            // Fix: LLM uses "name" or "data_element_name" instead of "data_element"
            if (!elem.data_element && elem.name) {
                elem.data_element = elem.name;
            }
            if (!elem.data_element && elem.data_element_name) {
                elem.data_element = elem.data_element_name;
            }

            // Coerce cross_border to boolean
            if (typeof elem.cross_border === "string") {
                elem.cross_border = elem.cross_border === "true" || elem.cross_border === "yes";
            }

            return elem;
        });
    }

    // Normalize elements array (Step 3: Classification)
    if (Array.isArray(obj.elements)) {
        obj.elements = obj.elements.map((el: unknown) => {
            if (!el || typeof el !== "object") return el;
            const elem = el as Record<string, unknown>;

            // Coerce retention_compliant string → boolean | null
            if (typeof elem.retention_compliant === "string") {
                const val = elem.retention_compliant.toLowerCase();
                if (val === "true" || val === "yes") elem.retention_compliant = true;
                else if (val === "false" || val === "no") elem.retention_compliant = false;
                else if (val === "unknown" || val === "null" || val === "n/a") elem.retention_compliant = null;
                else elem.retention_compliant = null;
            }

            // Coerce cross_border_transfer string → boolean
            if (typeof elem.cross_border_transfer === "string") {
                elem.cross_border_transfer = elem.cross_border_transfer === "true" || elem.cross_border_transfer === "yes";
            }

            // Coerce cross_border_details string → object | null
            if (typeof elem.cross_border_details === "string") {
                const s = elem.cross_border_details as string;
                if (!s || s === "null" || s === "N/A" || s === "n/a" || s === "Not applicable") {
                    elem.cross_border_details = null;
                } else {
                    // Try to parse as JSON, otherwise wrap in object
                    try {
                        elem.cross_border_details = JSON.parse(s);
                    } catch {
                        elem.cross_border_details = { destination_country: s, transfer_mechanism: "unknown" };
                    }
                }
            }

            // Coerce consent_mechanism string → object | null
            if (typeof elem.consent_mechanism === "string") {
                const s = elem.consent_mechanism as string;
                if (!s || s === "null" || s === "N/A" || s === "n/a") {
                    elem.consent_mechanism = null;
                } else {
                    try {
                        elem.consent_mechanism = JSON.parse(s);
                    } catch {
                        elem.consent_mechanism = { type: s, collection_point: "unknown", withdrawal_method: "unknown" };
                    }
                }
            }

            // Coerce third_party_details string → array | null
            if (typeof elem.third_party_details === "string") {
                const s = elem.third_party_details as string;
                if (!s || s === "null" || s === "N/A" || s === "n/a") {
                    elem.third_party_details = null;
                } else {
                    try {
                        elem.third_party_details = JSON.parse(s);
                    } catch {
                        elem.third_party_details = null;
                    }
                }
            }

            // Fix: LLM uses "name" instead of "data_element_name"
            if (!elem.data_element_name && elem.name) {
                elem.data_element_name = elem.name;
            }
            if (!elem.data_element_name && elem.data_element) {
                elem.data_element_name = elem.data_element;
            }

            return elem;
        });
    }

    return obj;
}

/**
 * Call an LLM with a prompt and validate the response against a Zod schema.
 * Retries on parse/validation failures.
 */
export async function llmCall<T extends z.ZodTypeAny>(
    options: LLMCallOptions<T>
): Promise<z.infer<T>> {
    const provider = getProvider();
    const maxRetries = options.maxRetries ?? 2;
    const temperature = options.temperature ?? 0.1;

    const defaultModel =
        provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o";
    const model = options.model ?? defaultModel;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const raw =
                provider === "anthropic"
                    ? await callAnthropic(options.prompt, model, temperature)
                    : await callOpenAI(options.prompt, model, temperature);

            const jsonStr = extractJSON(raw);
            const parsed = JSON.parse(jsonStr);
            const normalized = normalizeLLMOutput(parsed);
            const validated = options.schema.parse(normalized);
            return validated;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`LLM call attempt ${attempt + 1} failed:`, lastError.message);

            if (attempt < maxRetries) {
                // Brief pause before retry
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    throw new Error(`LLM call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}
