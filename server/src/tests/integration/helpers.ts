import { UserModel, type IUser } from "../../models/User.model";
import { signAccessToken } from "../../utils/jwt";
import type { Role } from "../../constants/roles";

/** Creates a user directly in the DB (bypassing the rate-limited register endpoint) and returns a bearer token for it. */
export async function createAuthedUser(overrides: Partial<{
  name: string;
  email: string;
  password: string;
  role: Role;
  isEmailVerified: boolean;
}> = {}): Promise<{ user: IUser; token: string }> {
  const user = await UserModel.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: overrides.password ?? "Password123",
    role: overrides.role ?? "customer",
    // Default to verified so existing RBAC/CRUD tests aren't incidentally
    // blocked by the email-verification gate — that gate has its own
    // dedicated tests (see auth.integration.test.ts).
    isEmailVerified: overrides.isEmailVerified ?? true,
  });

  const token = signAccessToken({ sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  return { user, token };
}

export function authHeader(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}
