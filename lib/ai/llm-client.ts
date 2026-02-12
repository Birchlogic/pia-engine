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

    // Try to find JSON object/array boundaries
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        return raw.slice(start, end + 1);
    }

    return raw.trim();
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
            const validated = options.schema.parse(parsed);
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
