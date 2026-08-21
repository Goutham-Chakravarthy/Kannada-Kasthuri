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

// Helper to scrape duration from YouTube page
async function getYoutubeDuration(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return "4:00";
    const html = await res.text();
    
    // Look for approxDurationMs
    const match = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
    if (match && match[1]) {
      const ms = parseInt(match[1], 10);
      const totalSeconds = Math.round(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    // Fallback: look for meta tag duration
    const metaMatch = html.match(/<meta itemprop="duration" content="PT(\d+M\d+S|\d+S|\d+M|\d+H\d+M\d+S)">/);
    if (metaMatch && metaMatch[1]) {
      const dur = metaMatch[1];
      let minutes = 0;
      let seconds = 0;
      const mMatch = dur.match(/(\d+)M/);
      const sMatch = dur.match(/(\d+)S/);
      if (mMatch) minutes = parseInt(mMatch[1], 10);
      if (sMatch) seconds = parseInt(sMatch[1], 10);
      if (!mMatch && sMatch) {
        const total = parseInt(sMatch[1], 10);
        minutes = Math.floor(total / 60);
        seconds = total % 60;
      }
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  } catch (e) {
    console.error(`Error fetching duration for ${videoId}:`, e);
  }
  return "4:00";
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

    // Scrape duration dynamically
    const duration = await getYoutubeDuration(videoId);

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
        duration,
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
      duration,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      rawTitle,
      authorName,
    });
  } catch (error) {
    console.error("Error fetching YouTube info:", error);
    return NextResponse.json({ error: "Failed to fetch YouTube details" }, { status: 500 });
  }
}
