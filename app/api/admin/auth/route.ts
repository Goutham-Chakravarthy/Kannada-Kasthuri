import { NextResponse } from "next/server";
import {
  validateCredentials,
  createSessionToken,
  verifyAdminRequest,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/admin/auth - Login
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    const response = NextResponse.json({
      success: true,
      message: "Authenticated successfully",
      user: "admin",
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

// GET /api/admin/auth - Check Session Status
export async function GET(request: Request) {
  const isAuthenticated = verifyAdminRequest(request);
  return NextResponse.json({
    authenticated: isAuthenticated,
    user: isAuthenticated ? "admin" : null,
  });
}

// DELETE /api/admin/auth - Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
