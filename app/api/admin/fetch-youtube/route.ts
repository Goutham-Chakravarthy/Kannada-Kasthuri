import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Helper to extract YouTube Video ID from any URL format
function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const input = urlOrId.trim();

  // Raw 11 character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // youtu.be/ID
  const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=ID
  const watchMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/embed/ID
  const embedMatch = input.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/shorts/ID
  const shortsMatch = input.match(/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

// Clean title and try to extract Title, Artist, Film, and Year heuristically
function parseSongDetails(rawTitle: string, authorName: string) {
  let title = rawTitle;
  let artist = "";
  let film = "";
  let year = new Date().getFullYear();

  // Try to find year (4 digits between 1950 and 2030)
  const yearMatch = rawTitle.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Remove common YouTube tags & suffix noise
  let cleaned = rawTitle
    .replace(/\|\s*Full\s*HD.*$/i, "")
    .replace(/\|\s*HD\s*Video.*$/i, "")
    .replace(/\|\s*4K.*$/i, "")
    .replace(/\|\s*Lyrical.*$/i, "")
    .replace(/\|\s*Video\s*Song.*$/i, "")
    .replace(/\|\s*Audio\s*Song.*$/i, "")
    .replace(/\[\s*HD\s*\].*$/i, "")
    .replace(/-\s*HD\s*Video\s*Song.*/i, "")
    .replace(/-\s*Kannada\s*Sad\s*Song.*/i, "")
    .replace(/-\s*Video\s*Song.*/i, "")
    .replace(/-\s*Lyrical.*/i, "")
    .trim();

  // Split by common separators: "-" or "|"
  if (cleaned.includes("|")) {
    const parts = cleaned.split("|").map((p) => p.trim());
    if (parts.length >= 2) {
      title = parts[0];
      // Second part is often film or artist
      const second = parts[1];
      if (/movie|cinema|film/i.test(second)) {
        film = second.replace(/movie|cinema|film|kannada/gi, "").trim();
      } else {
        film = second;
      }
      if (parts.length >= 3) {
        artist = parts[2];
      }
    }
  } else if (cleaned.includes("-")) {
    const parts = cleaned.split("-").map((p) => p.trim());
    if (parts.length >= 2) {
      title = parts[0];
      film = parts[1].replace(/movie|cinema|film|kannada/gi, "").trim();
      if (parts.length >= 3) {
        artist = parts[2];
      }
    }
  } else {
    title = cleaned;
  }

  // Default fallback for author if artist is empty
  if (!artist && authorName && !authorName.includes("Music") && !authorName.includes("Hits")) {
    artist = authorName;
  }

  return {
    title: title.trim() || rawTitle,
    artist: artist.trim(),
    film: film.trim(),
    year,
  };
}

// POST /api/admin/fetch-youtube
export async function POST(request: Request) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "YouTube URL or ID is required" }, { status: 400 });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL or Video ID" }, { status: 400 });
    }

    // Query YouTube oEmbed API
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json({
        videoId,
        title: "",
        artist: "",
        film: "",
        year: new Date().getFullYear(),
        duration: "4:00",
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        rawTitle: "",
      });
    }

    const data = await res.json();
    const rawTitle = data.title || "";
    const authorName = data.author_name || "";
    const parsed = parseSongDetails(rawTitle, authorName);

    return NextResponse.json({
      videoId,
      title: parsed.title,
      artist: parsed.artist,
      film: parsed.film,
      year: parsed.year,
      duration: "4:15",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      rawTitle,
      authorName,
    });
  } catch (error) {
    console.error("Error fetching YouTube info:", error);
    return NextResponse.json({ error: "Failed to fetch YouTube details" }, { status: 500 });
  }
}
