import { NextResponse } from "next/server";

// Simple in-memory tracker for active client timestamps
const activeClients: Record<string, number> = {};

export async function GET(request: Request) {
  // Use a combination of IP / User-Agent or fallback as a client identifier
  const ip = request.headers.get("x-forwarded-for") || "local-client";
  activeClients[ip] = Date.now();

  // Prune clients that haven't checked in for over 15 seconds
  const now = Date.now();
  Object.keys(activeClients).forEach((client) => {
    if (now - activeClients[client] > 15000) {
      delete activeClients[client];
    }
  });

  const onlineCount = Object.keys(activeClients).length;

  return NextResponse.json({ online: Math.max(1, onlineCount) });
}
