// Write access control. The frontend signs users in with Firebase Auth (Google)
// and sends the Firebase ID token as `Authorization: Bearer <token>`; the server
// verifies it and checks the email against ALLOWED_EMAILS.

export interface VerifiedUser {
  email: string;
}

/** Verifies a Firebase ID token and returns the signed-in user, or throws. */
export type TokenVerifier = (idToken: string) => Promise<VerifiedUser>;

export interface AuthConfig {
  /** Skip auth entirely (local development only). */
  disabled: boolean;
  /** Exact emails ("ana@example.com") or whole domains ("@example.com"). */
  allowedEmails: string[];
  /** Let anyone read annotations without signing in. */
  publicRead: boolean;
}

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const config: AuthConfig = {
    disabled: env.AUTH_DISABLED === "true",
    allowedEmails: parseAllowlist(env.ALLOWED_EMAILS),
    publicRead: env.PUBLIC_READ !== "false",
  };
  if (!config.disabled && config.allowedEmails.length === 0) {
    throw new Error(
      "ALLOWED_EMAILS is empty. Set it to the emails (or @domains) allowed to edit " +
        "annotations, or set AUTH_DISABLED=true for local development."
    );
  }
  return config;
}

export function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return false;
  const domain = normalized.slice(at);
  return allowlist.some((entry) => entry === normalized || (entry.startsWith("@") && entry === domain));
}

export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match ? match[1].trim() : null;
}

/** Verifier backed by firebase-admin, using Application Default Credentials. */
export async function firebaseVerifier(projectId?: string): Promise<TokenVerifier> {
  const { initializeApp, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const app = getApps()[0] ?? initializeApp(projectId ? { projectId } : undefined);
  const auth = getAuth(app);
  return async (idToken) => {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.email || decoded.email_verified !== true) {
      throw new Error("token has no verified email");
    }
    return { email: decoded.email };
  };
}
