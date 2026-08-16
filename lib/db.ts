import fs from "fs/promises";
import path from "path";
import { Track, PlaylistInfo, evergreenTracks, sadMelodiesTracks } from "@/app/tracks";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "playlists.json");

// Ensure data directory and playlists.json exist with seed data
async function ensureDb(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      // Seed default playlists
      const initialPlaylists: PlaylistInfo[] = [
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
      await fs.writeFile(DB_FILE, JSON.stringify(initialPlaylists, null, 2), "utf-8");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Read all playlists from the JSON file
export async function getPlaylists(): Promise<PlaylistInfo[]> {
  await ensureDb();
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data) as PlaylistInfo[];
  } catch (error) {
    console.error("Error reading playlists:", error);
    return [
      {
        id: "evergreen",
        name: "Evergreen Hits",
        description: "Golden retro classics from Kannada cinema",
        tracks: evergreenTracks,
      },
      {
        id: "sad-melodies",
        name: "Sad Melodies",
        description: "Heart-touching soulful and emotional Kannada melodies",
        tracks: sadMelodiesTracks,
      },
    ];
  }
}

// Write playlists back to the JSON file
async function savePlaylists(playlists: PlaylistInfo[]): Promise<void> {
  await ensureDb();
  await fs.writeFile(DB_FILE, JSON.stringify(playlists, null, 2), "utf-8");
}

// Get a single playlist by ID
export async function getPlaylistById(id: string): Promise<PlaylistInfo | null> {
  const playlists = await getPlaylists();
  return playlists.find((p) => p.id === id) || null;
}

// Create a new playlist
export async function createPlaylist(
  name: string,
  description?: string,
  bgLandscape?: string,
  bgPortrait?: string
): Promise<PlaylistInfo> {
  const playlists = await getPlaylists();
  
  // Generate safe slug id
  let baseId = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  if (!baseId) {
    baseId = `playlist-${Date.now()}`;
  }

  let id = baseId;
  let counter = 1;
  while (playlists.some((p) => p.id === id)) {
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

  playlists.push(newPlaylist);
  await savePlaylists(playlists);
  return newPlaylist;
}

// Update playlist metadata (name, description, backgrounds)
export async function updatePlaylist(
  id: string,
  updates: Partial<Pick<PlaylistInfo, "name" | "description" | "bgLandscape" | "bgPortrait">>
): Promise<PlaylistInfo | null> {
  const playlists = await getPlaylists();
  const index = playlists.findIndex((p) => p.id === id);
  if (index === -1) return null;

  playlists[index] = {
    ...playlists[index],
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.bgLandscape !== undefined ? { bgLandscape: updates.bgLandscape.trim() } : {}),
    ...(updates.bgPortrait !== undefined ? { bgPortrait: updates.bgPortrait.trim() } : {}),
  };

  await savePlaylists(playlists);
  return playlists[index];
}

// Delete a playlist
export async function deletePlaylist(id: string): Promise<boolean> {
  const playlists = await getPlaylists();
  const filtered = playlists.filter((p) => p.id !== id);
  if (filtered.length === playlists.length) return false;

  await savePlaylists(filtered);
  return true;
}

// Add a track to a playlist
export async function addTrackToPlaylist(
  playlistId: string,
  trackData: Omit<Track, "id"> & { id?: string }
): Promise<Track | null> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const newTrack: Track = {
    id: trackData.id || `track-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: trackData.title.trim(),
    artist: trackData.artist.trim(),
    film: trackData.film.trim(),
    year: Number(trackData.year) || new Date().getFullYear(),
    duration: trackData.duration?.trim() || "4:00",
    videoId: trackData.videoId.trim(),
  };

  playlist.tracks.push(newTrack);
  await savePlaylists(playlists);
  return newTrack;
}

// Add multiple tracks to a playlist in bulk
export async function addMultipleTracksToPlaylist(
  playlistId: string,
  tracksData: (Omit<Track, "id"> & { id?: string })[]
): Promise<Track[] | null> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const addedTracks: Track[] = tracksData.map((t, idx) => ({
    id: t.id || `track-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
    title: t.title.trim(),
    artist: t.artist?.trim() || "Various Artists",
    film: t.film?.trim() || "",
    year: Number(t.year) || new Date().getFullYear(),
    duration: t.duration?.trim() || "4:00",
    videoId: t.videoId.trim(),
  }));

  playlist.tracks.push(...addedTracks);
  await savePlaylists(playlists);
  return addedTracks;
}

// Update a track in a playlist
export async function updateTrack(
  playlistId: string,
  trackId: string,
  updates: Partial<Omit<Track, "id">>
): Promise<Track | null> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const trackIndex = playlist.tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1) return null;

  playlist.tracks[trackIndex] = {
    ...playlist.tracks[trackIndex],
    ...(updates.title ? { title: updates.title.trim() } : {}),
    ...(updates.artist ? { artist: updates.artist.trim() } : {}),
    ...(updates.film ? { film: updates.film.trim() } : {}),
    ...(updates.year !== undefined ? { year: Number(updates.year) } : {}),
    ...(updates.duration ? { duration: updates.duration.trim() } : {}),
    ...(updates.videoId ? { videoId: updates.videoId.trim() } : {}),
  };

  await savePlaylists(playlists);
  return playlist.tracks[trackIndex];
}

// Delete a track from a playlist
export async function deleteTrack(playlistId: string, trackId: string): Promise<boolean> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) return false;

  const initialCount = playlist.tracks.length;
  playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId);
  if (playlist.tracks.length === initialCount) return false;

  await savePlaylists(playlists);
  return true;
}

// Reorder tracks in a playlist
export async function reorderTracks(playlistId: string, trackIds: string[]): Promise<boolean> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
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

  // Append any tracks that were not in trackIds
  trackMap.forEach((t) => reordered.push(t));

  playlist.tracks = reordered;
  await savePlaylists(playlists);
  return true;
}
