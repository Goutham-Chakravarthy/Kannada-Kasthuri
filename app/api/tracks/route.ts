import { NextResponse } from "next/server";
import { getShuffledTracks } from "@/app/tracks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const shuffled = getShuffledTracks();
  return NextResponse.json(
    { tracks: shuffled },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
