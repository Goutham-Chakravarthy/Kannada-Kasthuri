import { NextResponse } from "next/server";
import { updateTrack, deleteTrack } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; trackId: string }>;
}

// PUT /api/playlists/[id]/tracks/[trackId] - Update track details (Admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, trackId } = await params;
    const body = await request.json();

    const updated = await updateTrack(id, trackId, body);
    if (!updated) {
      return NextResponse.json({ error: "Track or playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, track: updated });
  } catch (error) {
    console.error("Error updating track:", error);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }
}

// DELETE /api/playlists/[id]/tracks/[trackId] - Delete track from playlist (Admin only)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, trackId } = await params;
    const deleted = await deleteTrack(id, trackId);
    if (!deleted) {
      return NextResponse.json({ error: "Track or playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Track deleted" });
  } catch (error) {
    console.error("Error deleting track:", error);
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 });
  }
}
