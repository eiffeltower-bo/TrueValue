import { api } from "./client";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  admin: boolean;
  superuser: boolean;
  role: "agent" | "admin";
  last_login: string | null;
  created_at: string;
};

export function listUsers(): Promise<User[]> {
  return api.get<User[]>("/users");
}

export function getUser(id: number | string): Promise<User> {
  return api.get<User>(`/users/${id}`);
}

export function displayName(user: Pick<User, "username" | "first_name" | "last_name">): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return full || user.username;
}
