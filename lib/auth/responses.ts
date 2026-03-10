import { NextResponse } from "next/server";

// ─── Standardized API Responses ───

interface SuccessResponse<T = unknown> {
    success: true;
    data: T;
}

interface ErrorResponse {
    success: false;
    message: string;
}

export function successResponse<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
    return NextResponse.json({ success: true as const, data }, { status });
}

export function errorResponse(message: string, status = 400): NextResponse<ErrorResponse> {
    return NextResponse.json({ success: false as const, message }, { status });
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse<ErrorResponse> {
    return errorResponse(message, 401);
}

export function forbiddenResponse(message = "Forbidden"): NextResponse<ErrorResponse> {
    return errorResponse(message, 403);
}

export function notFoundResponse(message = "Not found"): NextResponse<ErrorResponse> {
    return errorResponse(message, 404);
}

export function serverErrorResponse(message = "Internal server error"): NextResponse<ErrorResponse> {
    return errorResponse(message, 500);
}
