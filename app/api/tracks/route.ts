import { NextResponse } from "next/server";
import { getPlaylists } from "@/lib/db";
import { shuffleTrackList } from "@/app/tracks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlist") || "evergreen";
    const playlists = await getPlaylists();
    const pl = playlists.find((p) => p.id === playlistId) || playlists[0];
    const shuffled = shuffleTrackList(pl ? pl.tracks : []);

    return NextResponse.json(
      { tracks: shuffled, playlist: pl },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching tracks:", error);
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
  }
}

