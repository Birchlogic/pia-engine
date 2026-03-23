import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatError(error: any): string {
  if (!error) return "An unknown error occurred";
  if (typeof error === "string") return error;
  
  // Handle GraphQL/FastAPI detail array
  if (Array.isArray(error)) {
    return error.map(err => {
      if (typeof err === "string") return err;
      if (err.msg) return err.msg;
      return JSON.stringify(err);
    }).join(", ");
  }
  
  if (typeof error === "object") {
    if (error.message) return error.message;
    if (error.msg) return error.msg;
    return JSON.stringify(error);
  }
  
  return String(error);
}
