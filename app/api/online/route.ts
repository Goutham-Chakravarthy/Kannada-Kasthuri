import { NextResponse } from "next/server";
import { pingSession, getAccurateOnlineCount, removeSession } from "@/lib/online";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId =
    searchParams.get("sessionId") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "client-default";

  const count = await pingSession(sessionId);

  return NextResponse.json(
    { online: count },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId;
    if (sessionId) {
      if (body.action === "leave") {
        await removeSession(sessionId);
        const count = await getAccurateOnlineCount();
        return NextResponse.json({ online: count });
      }
      const count = await pingSession(sessionId);
      return NextResponse.json({ online: count });
    }
  } catch {}

  const count = await getAccurateOnlineCount();
  return NextResponse.json({ online: count });
}
