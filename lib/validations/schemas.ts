import { z } from "zod";

// ─── Super Admin ───

export const superAdminLoginSchema = z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(1, "Password is required"),
});

// ─── Organization ───

export const createOrgSchema = z.object({
    orgName: z.string().min(1, "Organization name is required").max(200),
    industry: z.string().optional(),
    jurisdiction: z.string().optional(),
    regulatoryScope: z.array(z.string()).optional().default([]),
    sizeBand: z.enum(["micro", "small", "medium", "large", "enterprise"]).optional(),
    projectLimit: z.number().int().positive().optional().default(3),
    adminUser: z.object({
        name: z.string().min(1, "Admin name is required").max(200),
        email: z.string().email("Valid admin email is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
    }),
});

// ─── User Management ───

export const addUserSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["admin", "senior_assessor", "analyst"]).default("analyst"),
});

// ─── Projects ───

export const createProjectSchema = z.object({
    orgId: z.string().min(1, "Valid organization ID is required"),
    name: z.string().min(1, "Project name is required").max(200),
    description: z.string().optional(),
    applicableRegulations: z.array(z.string()).optional().default([]),
    assessmentType: z.enum(["full_pia", "dpia", "ai_governance", "custom"]).optional().default("full_pia"),
    targetCompletionDate: z.string().datetime().optional().nullable(),
});

// ─── Verticals ───

export const createVerticalSchema = z.object({
    projectId: z.string().min(1, "Valid project ID is required"),
    name: z.string().min(1, "Vertical name is required").max(200),
    description: z.string().optional(),
    headName: z.string().optional(),
    headRole: z.string().optional(),
    headContact: z.string().optional(),
});

// ─── Sessions ───

export const createSessionSchema = z.object({
    verticalId: z.string().min(1, "Valid vertical ID is required"),
    sessionDate: z.string().datetime().optional(),
    durationMinutes: z.number().int().positive().optional(),
    interviewerNames: z.array(z.string()).optional().default([]),
    intervieweeNames: z.array(z.string()).optional().default([]),
    intervieweeRoles: z.array(z.string()).optional().default([]),
    assessmentCriteriaTags: z.array(z.string()).optional().default([]),
    rawTextNotes: z.string().optional(),
});

// ─── Project Membership ───

export const addProjectMemberSchema = z.object({
    userId: z.string().min(1, "Valid user ID is required"),
    role: z.enum(["owner", "editor", "viewer"]).default("viewer"),
});

// ─── Helper: validate and return typed data or error string ───

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: string } {
    const result = schema.safeParse(body);
    if (!result.success) {
        const firstError = result.error?.errors?.[0];
        if (firstError) {
            const pathInfo = Array.isArray(firstError.path) ? firstError.path.join(".") : "";
            const errMsg = `${pathInfo ? pathInfo + ": " : ""}${firstError.message}`;
            console.error("[Zod Validation Error]:", errMsg, body);
            return { error: errMsg };
        }
        console.error("[Zod Validation Error] Unknown:", result.error, body);
        return { error: "Validation failed" };
    }
    return { data: result.data };
}
