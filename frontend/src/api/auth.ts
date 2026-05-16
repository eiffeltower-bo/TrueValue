import { admin, ApiError, readCookie } from "./client";

export type CurrentUser = {
  user_id: number;
  username: string;
};

type AdminMeResponse = {
  user_id: string | number;
  username: string;
};

async function ensureCsrfToken(): Promise<string> {
  let token = readCookie("csrftoken");
  if (!token) {
    await admin.get<unknown>("/").catch(() => {
      // The admin index sets the csrftoken cookie; we ignore body errors.
    });
    token = readCookie("csrftoken");
  }
  if (!token) {
    throw new Error("Could not obtain csrftoken cookie from the admin endpoint.");
  }
  return token;
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  const csrf = await ensureCsrfToken();
  await admin.post<{ message: string }>(
    "/public/login/",
    { username, password },
    { "X-CSRFToken": csrf },
  );
  return getCurrentUser();
}

export async function logout(): Promise<void> {
  const csrf = readCookie("csrftoken");
  await admin.post<unknown>(
    "/public/logout/",
    {},
    csrf ? { "X-CSRFToken": csrf } : undefined,
  );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const raw = await admin.get<AdminMeResponse>("/api/user/");
  return {
    user_id: Number(raw.user_id),
    username: raw.username,
  };
}

export async function tryGetCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}
