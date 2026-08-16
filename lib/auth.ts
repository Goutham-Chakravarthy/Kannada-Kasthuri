import crypto from "crypto";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "kasthuri-admin-2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "kannada-kasthuri-auth-secret-key-2026";
export const ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH || "kasthuri-studio-9842";
export const AUTH_COOKIE_NAME = "kk_admin_session";

// Validate admin login credentials
export function validateCredentials(username?: string, password?: string): boolean {
  if (!username || !password) return false;
  return username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

// Generate signed session token: timestamp.signature
export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(`admin:${timestamp}`)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

// Verify session token validity (valid for 7 days)
export function verifySessionToken(token?: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Max age: 7 days
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > maxAgeMs) return false;

  const expectedSignature = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(`admin:${timestampStr}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

// Helper to extract cookie from request headers
function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

// Verify request authorization (checks Cookie or Authorization Header)
export function verifyAdminRequest(request: Request): boolean {
  // 1. Check Bearer Token header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (verifySessionToken(token)) return true;
  }

  // 2. Check HTTP-only cookie
  const cookieToken = getCookie(request, AUTH_COOKIE_NAME);
  if (cookieToken && verifySessionToken(cookieToken)) {
    return true;
  }

  return false;
}
