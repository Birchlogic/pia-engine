/**
 * LLM Adapter Layer
 *
 * Provides a unified interface for calling different LLM providers (Claude, OpenAI, OpenRouter).
 * Reads the active provider config from the database and instantiates the correct adapter.
 */

import prisma from "@/lib/db/prisma";

// ─── Types ───

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LlmOptions {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface LlmResponse {
    content: string;
    model: string;
    provider: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
}

export interface LlmAdapter {
    chat(messages: ChatMessage[], options?: LlmOptions): Promise<LlmResponse>;
}

// ─── Claude Adapter ───

class ClaudeAdapter implements LlmAdapter {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResponse> {
        const systemMessage = messages.find((m) => m.role === "system");
        const nonSystemMessages = messages.filter((m) => m.role !== "system");

        const body: Record<string, unknown> = {
            model: this.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
        };

        if (systemMessage) {
            body.system = systemMessage.content;
        }

        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Claude API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const textBlock = data.content?.find((b: any) => b.type === "text");

        return {
            content: textBlock?.text || "",
            model: data.model || this.model,
            provider: "CLAUDE",
            usage: {
                inputTokens: data.usage?.input_tokens,
                outputTokens: data.usage?.output_tokens,
            },
        };
    }
}

// ─── OpenAI Adapter ───

class OpenAIAdapter implements LlmAdapter {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResponse> {
        const body = {
            model: this.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
        };

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content || "",
            model: data.model || this.model,
            provider: "OPENAI",
            usage: {
                inputTokens: data.usage?.prompt_tokens,
                outputTokens: data.usage?.completion_tokens,
            },
        };
    }
}

// ─── OpenRouter Adapter ───

class OpenRouterAdapter implements LlmAdapter {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResponse> {
        const body = {
            model: this.model,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
        };

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content || "",
            model: data.model || this.model,
            provider: "OPENROUTER",
            usage: {
                inputTokens: data.usage?.prompt_tokens,
                outputTokens: data.usage?.completion_tokens,
            },
        };
    }
}

// ─── Factory ───

/**
 * Get the currently active LLM adapter from the database.
 * Throws if no active provider is configured.
 */
export async function getActiveLlmAdapter(): Promise<LlmAdapter> {
    const activeProvider = await prisma.llmProvider.findFirst({
        where: { status: "ACTIVE" },
    });

    if (!activeProvider) {
        throw new Error("No active LLM provider configured. Please configure one in the Super Admin dashboard.");
    }

    switch (activeProvider.type) {
        case "CLAUDE":
            return new ClaudeAdapter(activeProvider.apiKey, activeProvider.model);
        case "OPENAI":
            return new OpenAIAdapter(activeProvider.apiKey, activeProvider.model);
        case "OPENROUTER":
            return new OpenRouterAdapter(activeProvider.apiKey, activeProvider.model);
        default:
            throw new Error(`Unknown LLM provider type: ${activeProvider.type}`);
    }
}

/**
 * Get info about the currently active provider (without the full API key).
 */
export async function getActiveProviderInfo() {
    const provider = await prisma.llmProvider.findFirst({
        where: { status: "ACTIVE" },
        select: {
            id: true,
            type: true,
            model: true,
            status: true,
        },
    });

    return provider;
}
