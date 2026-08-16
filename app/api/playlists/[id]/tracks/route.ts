import { NextResponse } from "next/server";
import { addTrackToPlaylist, addMultipleTracksToPlaylist, reorderTracks } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/playlists/[id]/tracks - Add track(s) to the playlist (Admin only)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if bulk tracks array provided: { tracks: [...] } or [...]
    const tracksArray = Array.isArray(body) ? body : Array.isArray(body.tracks) ? body.tracks : null;

    if (tracksArray) {
      if (tracksArray.length === 0) {
        return NextResponse.json({ error: "Tracks array cannot be empty" }, { status: 400 });
      }

      // Filter valid tracks with title and videoId
      const validTracks = tracksArray.filter((t: any) => t && t.title && t.videoId);
      if (validTracks.length === 0) {
        return NextResponse.json(
          { error: "No valid tracks with title and videoId found" },
          { status: 400 }
        );
      }

      const addedTracks = await addMultipleTracksToPlaylist(id, validTracks);
      if (!addedTracks) {
        return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
      }

      return NextResponse.json(
        { success: true, count: addedTracks.length, tracks: addedTracks },
        { status: 201 }
      );
    }

    // Single track insertion
    const { title, artist, film, year, duration, videoId } = body;

    if (!title || !videoId) {
      return NextResponse.json(
        { error: "Track title and YouTube Video ID are required" },
        { status: 400 }
      );
    }

    const addedTrack = await addTrackToPlaylist(id, {
      title,
      artist: artist || "Various Artists",
      film: film || "",
      year: Number(year) || new Date().getFullYear(),
      duration: duration || "4:00",
      videoId,
    });

    if (!addedTrack) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, track: addedTrack }, { status: 201 });
  } catch (error) {
    console.error("Error adding track(s) to playlist:", error);
    return NextResponse.json({ error: "Failed to add track(s)" }, { status: 500 });
  }
}

// PUT /api/playlists/[id]/tracks - Reorder tracks in playlist (Admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { trackIds } = body;

    if (!Array.isArray(trackIds)) {
      return NextResponse.json({ error: "trackIds array is required" }, { status: 400 });
    }

    const success = await reorderTracks(id, trackIds);
    if (!success) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Tracks reordered" });
  } catch (error) {
    console.error("Error reordering tracks:", error);
    return NextResponse.json({ error: "Failed to reorder tracks" }, { status: 500 });
  }
}
