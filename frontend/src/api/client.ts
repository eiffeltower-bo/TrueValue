// Defaults are relative — Vite's dev proxy forwards /api and /admin to the backend
// (see vite.config.ts). Override via env when serving the SPA without that proxy.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_BASE_URL ?? "/admin";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type FetchInit = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(baseUrl: string, path: string, init: FetchInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);

  let finalBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || typeof body === "string") {
      finalBody = body as BodyInit;
    } else {
      finalBody = JSON.stringify(body);
      if (!finalHeaders.has("Content-Type")) {
        finalHeaders.set("Content-Type", "application/json");
      }
    }
  }
  if (!finalHeaders.has("Accept")) {
    finalHeaders.set("Accept", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    credentials: "include",
    headers: finalHeaders,
    body: finalBody,
  });

  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message = extractErrorMessage(parsed) ?? response.statusText;
    throw new ApiError(response.status, parsed, message);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return null;
}

export const api = {
  get: <T>(path: string) => request<T>(API_BASE_URL, path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(API_BASE_URL, path, { method: "POST", body }),
};

export const admin = {
  get: <T>(path: string) => request<T>(ADMIN_BASE_URL, path, { method: "GET" }),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(ADMIN_BASE_URL, path, { method: "POST", body, headers }),
};

export function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
