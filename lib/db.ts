import fs from "fs/promises";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Track, PlaylistInfo, evergreenTracks, sadMelodiesTracks } from "@/app/tracks";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "playlists.json");

// Default initial playlists for seeding
const DEFAULT_PLAYLISTS: PlaylistInfo[] = [
  {
    id: "evergreen",
    name: "Evergreen Hits",
    description: "Golden retro classics from Kannada cinema",
    bgLandscape: "/bg/bg-video.mp4",
    bgPortrait: "/bg/Portrait-mobile.png",
    tracks: evergreenTracks,
  },
  {
    id: "sad-melodies",
    name: "Sad Melodies",
    description: "Heart-touching soulful and emotional Kannada melodies",
    bgLandscape: "/bg/bg-video.mp4",
    bgPortrait: "/bg/Portrait-mobile.png",
    tracks: sadMelodiesTracks,
  },
];

// Helper to create Supabase Server/Admin client
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return null;
  }
}

// Convert Supabase row to PlaylistInfo
function mapRowToPlaylist(row: any): PlaylistInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    bgLandscape: row.bg_landscape || row.bgLandscape || "/bg/bg-video.mp4",
    bgPortrait: row.bg_portrait || row.bgPortrait || "/bg/Portrait-mobile.png",
    tracks: Array.isArray(row.tracks) ? row.tracks : [],
  };
}

// Convert PlaylistInfo to Supabase row format
function mapPlaylistToRow(pl: PlaylistInfo) {
  return {
    id: pl.id,
    name: pl.name,
    description: pl.description || "",
    bg_landscape: pl.bgLandscape || "/bg/bg-video.mp4",
    bg_portrait: pl.bgPortrait || "/bg/Portrait-mobile.png",
    tracks: pl.tracks || [],
    updated_at: new Date().toISOString(),
  };
}

// --- Local File Fallback Operations ---
async function ensureLocalDb(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_PLAYLISTS, null, 2), "utf-8");
    }
  } catch (error) {
    console.error("Local database initialization error:", error);
  }
}

async function getLocalPlaylists(): Promise<PlaylistInfo[]> {
  await ensureLocalDb();
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data) as PlaylistInfo[];
  } catch (error) {
    console.error("Error reading local playlists:", error);
    return DEFAULT_PLAYLISTS;
  }
}

async function saveLocalPlaylists(playlists: PlaylistInfo[]): Promise<void> {
  try {
    await ensureLocalDb();
    await fs.writeFile(DB_FILE, JSON.stringify(playlists, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save to local filesystem (expected in read-only serverless environment):", e);
  }
}

// Auto-seed default playlists to Supabase if empty
let isSeeding = false;
async function seedSupabaseIfEmpty(supabase: SupabaseClient): Promise<void> {
  if (isSeeding) return;
  try {
    isSeeding = true;
    for (const pl of DEFAULT_PLAYLISTS) {
      await supabase.from("playlists").upsert(mapPlaylistToRow(pl), { onConflict: "id" });
    }
  } catch (e) {
    console.error("Failed to seed Supabase playlists:", e);
  } finally {
    isSeeding = false;
  }
}

// --- Core Exported Database Methods ---

// Read all playlists
export async function getPlaylists(): Promise<PlaylistInfo[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        if (data.length === 0) {
          await seedSupabaseIfEmpty(supabase);
          return DEFAULT_PLAYLISTS;
        }
        return data.map(mapRowToPlaylist);
      }
      if (error) {
        console.warn("Supabase query error (falling back to local):", error.message);
      }
    } catch (err) {
      console.warn("Supabase connection error (falling back to local):", err);
    }
  }

  return getLocalPlaylists();
}

// Get a single playlist by ID
export async function getPlaylistById(id: string): Promise<PlaylistInfo | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return mapRowToPlaylist(data);
      }
    } catch (err) {
      console.warn("Supabase getPlaylistById error:", err);
    }
  }

  const playlists = await getLocalPlaylists();
  return playlists.find((p) => p.id === id) || null;
}

// Create a new playlist
export async function createPlaylist(
  name: string,
  description?: string,
  bgLandscape?: string,
  bgPortrait?: string
): Promise<PlaylistInfo> {
  let baseId = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseId) {
    baseId = `playlist-${Date.now()}`;
  }

  const existingPlaylists = await getPlaylists();
  let id = baseId;
  let counter = 1;
  while (existingPlaylists.some((p) => p.id === id)) {
    id = `${baseId}-${counter++}`;
  }

  const newPlaylist: PlaylistInfo = {
    id,
    name: name.trim(),
    description: description?.trim() || "",
    bgLandscape: bgLandscape?.trim() || "/bg/bg-video.mp4",
    bgPortrait: bgPortrait?.trim() || "/bg/Portrait-mobile.png",
    tracks: [],
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("playlists").insert(mapPlaylistToRow(newPlaylist));
      if (error) {
        console.error("Supabase createPlaylist error:", error);
      }
    } catch (e) {
      console.error("Supabase createPlaylist exception:", e);
    }
  }

  // Also sync locally
  const localList = await getLocalPlaylists();
  localList.push(newPlaylist);
  await saveLocalPlaylists(localList);

  return newPlaylist;
}

// Update playlist metadata (name, description, backgrounds)
export async function updatePlaylist(
  id: string,
  updates: Partial<Pick<PlaylistInfo, "name" | "description" | "bgLandscape" | "bgPortrait">>
): Promise<PlaylistInfo | null> {
  const current = await getPlaylistById(id);
  if (!current) return null;

  const updated: PlaylistInfo = {
    ...current,
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.bgLandscape !== undefined ? { bgLandscape: updates.bgLandscape.trim() } : {}),
    ...(updates.bgPortrait !== undefined ? { bgPortrait: updates.bgPortrait.trim() } : {}),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.name) dbUpdates.name = updates.name.trim();
      if (updates.description !== undefined) dbUpdates.description = updates.description.trim();
      if (updates.bgLandscape !== undefined) dbUpdates.bg_landscape = updates.bgLandscape.trim();
      if (updates.bgPortrait !== undefined) dbUpdates.bg_portrait = updates.bgPortrait.trim();

      const { error } = await supabase.from("playlists").update(dbUpdates).eq("id", id);
      if (error) console.error("Supabase updatePlaylist error:", error);
    } catch (e) {
      console.error("Supabase updatePlaylist exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const index = localList.findIndex((p) => p.id === id);
  if (index !== -1) {
    localList[index] = updated;
    await saveLocalPlaylists(localList);
  }

  return updated;
}

// Delete a playlist
export async function deletePlaylist(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) console.error("Supabase deletePlaylist error:", error);
    } catch (e) {
      console.error("Supabase deletePlaylist exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const filtered = localList.filter((p) => p.id !== id);
  if (filtered.length !== localList.length) {
    await saveLocalPlaylists(filtered);
    return true;
  }

  return true;
}

// Add a track to a playlist
export async function addTrackToPlaylist(
  playlistId: string,
  trackData: Omit<Track, "id"> & { id?: string }
): Promise<Track | null> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) return null;

  const newTrack: Track = {
    id: trackData.id || `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: trackData.title.trim(),
    artist: trackData.artist.trim(),
    film: trackData.film.trim(),
    year: Number(trackData.year) || new Date().getFullYear(),
    duration: trackData.duration?.trim() || "4:00",
    videoId: trackData.videoId.trim(),
  };

  const updatedTracks = [...playlist.tracks, newTrack];

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ tracks: updatedTracks, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) console.error("Supabase addTrack error:", error);
    } catch (e) {
      console.error("Supabase addTrack exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const localPl = localList.find((p) => p.id === playlistId);
  if (localPl) {
    localPl.tracks = updatedTracks;
    await saveLocalPlaylists(localList);
  }

  return newTrack;
}

// Add multiple tracks to a playlist in bulk
export async function addMultipleTracksToPlaylist(
  playlistId: string,
  tracksData: (Omit<Track, "id"> & { id?: string })[]
): Promise<Track[] | null> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) return null;

  const addedTracks: Track[] = tracksData.map((t, idx) => ({
    id: t.id || `track-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
    title: t.title.trim(),
    artist: t.artist?.trim() || "Various Artists",
    film: t.film?.trim() || "",
    year: Number(t.year) || new Date().getFullYear(),
    duration: t.duration?.trim() || "4:00",
    videoId: t.videoId.trim(),
  }));

  const updatedTracks = [...playlist.tracks, ...addedTracks];

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ tracks: updatedTracks, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) console.error("Supabase addMultipleTracks error:", error);
    } catch (e) {
      console.error("Supabase addMultipleTracks exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const localPl = localList.find((p) => p.id === playlistId);
  if (localPl) {
    localPl.tracks = updatedTracks;
    await saveLocalPlaylists(localList);
  }

  return addedTracks;
}

// Update a track in a playlist
export async function updateTrack(
  playlistId: string,
  trackId: string,
  updates: Partial<Omit<Track, "id">>
): Promise<Track | null> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) return null;

  const trackIndex = playlist.tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1) return null;

  const updatedTrack: Track = {
    ...playlist.tracks[trackIndex],
    ...(updates.title ? { title: updates.title.trim() } : {}),
    ...(updates.artist ? { artist: updates.artist.trim() } : {}),
    ...(updates.film ? { film: updates.film.trim() } : {}),
    ...(updates.year !== undefined ? { year: Number(updates.year) } : {}),
    ...(updates.duration ? { duration: updates.duration.trim() } : {}),
    ...(updates.videoId ? { videoId: updates.videoId.trim() } : {}),
  };

  const updatedTracks = [...playlist.tracks];
  updatedTracks[trackIndex] = updatedTrack;

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ tracks: updatedTracks, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) console.error("Supabase updateTrack error:", error);
    } catch (e) {
      console.error("Supabase updateTrack exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const localPl = localList.find((p) => p.id === playlistId);
  if (localPl) {
    localPl.tracks = updatedTracks;
    await saveLocalPlaylists(localList);
  }

  return updatedTrack;
}

// Delete a track from a playlist
export async function deleteTrack(playlistId: string, trackId: string): Promise<boolean> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) return false;

  const updatedTracks = playlist.tracks.filter((t) => t.id !== trackId);

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ tracks: updatedTracks, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) console.error("Supabase deleteTrack error:", error);
    } catch (e) {
      console.error("Supabase deleteTrack exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const localPl = localList.find((p) => p.id === playlistId);
  if (localPl) {
    localPl.tracks = updatedTracks;
    await saveLocalPlaylists(localList);
  }

  return true;
}

// Reorder tracks in a playlist
export async function reorderTracks(playlistId: string, trackIds: string[]): Promise<boolean> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) return false;

  const trackMap = new Map(playlist.tracks.map((t) => [t.id, t]));
  const reordered: Track[] = [];

  for (const id of trackIds) {
    const t = trackMap.get(id);
    if (t) {
      reordered.push(t);
      trackMap.delete(id);
    }
  }

  // Append any remaining tracks
  trackMap.forEach((t) => reordered.push(t));

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ tracks: reordered, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
      if (error) console.error("Supabase reorderTracks error:", error);
    } catch (e) {
      console.error("Supabase reorderTracks exception:", e);
    }
  }

  const localList = await getLocalPlaylists();
  const localPl = localList.find((p) => p.id === playlistId);
  if (localPl) {
    localPl.tracks = reordered;
    await saveLocalPlaylists(localList);
  }

  return true;
}
