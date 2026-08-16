import { NextResponse } from "next/server";
import { getPlaylistById, updatePlaylist, deletePlaylist } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/playlists/[id] - Get playlist by ID
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const playlist = await getPlaylistById(id);
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }
    return NextResponse.json({ playlist });
  } catch (error) {
    console.error("Error getting playlist:", error);
    return NextResponse.json({ error: "Failed to get playlist" }, { status: 500 });
  }
}

// PUT /api/playlists/[id] - Update playlist metadata (Admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, bgLandscape, bgPortrait } = body;

    const updated = await updatePlaylist(id, { name, description, bgLandscape, bgPortrait });
    if (!updated) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, playlist: updated });
  } catch (error) {
    console.error("Error updating playlist:", error);
    return NextResponse.json({ error: "Failed to update playlist" }, { status: 500 });
  }
}

// DELETE /api/playlists/[id] - Delete playlist (Admin only)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deletePlaylist(id);
    if (!deleted) {
      return NextResponse.json({ error: "Playlist not found or could not be deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Playlist deleted" });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    return NextResponse.json({ error: "Failed to delete playlist" }, { status: 500 });
  }
}
