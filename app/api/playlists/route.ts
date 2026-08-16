import { NextResponse } from "next/server";
import { getPlaylists, createPlaylist } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/playlists - List all playlists and their tracks
export async function GET() {
  try {
    const playlists = await getPlaylists();
    return NextResponse.json(
      { playlists },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}

// POST /api/playlists - Create a new playlist (Admin only)
export async function POST(request: Request) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, bgLandscape, bgPortrait } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });
    }

    const newPlaylist = await createPlaylist(name, description, bgLandscape, bgPortrait);
    return NextResponse.json({ success: true, playlist: newPlaylist }, { status: 201 });
  } catch (error) {
    console.error("Failed to create playlist:", error);
    return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
  }
}
