"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Track, PlaylistInfo } from "@/app/tracks";
import { isVideoUrl } from "@/components/BackgroundVideo";

export function AdminDashboard() {
  const [authStatus, setAuthStatus] = useState<"loading" | "unauthenticated" | "authenticated">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  // Playlists & Selection
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Quick Add via YouTube Link
  const [quickYtUrl, setQuickYtUrl] = useState("");
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [extractedSong, setExtractedSong] = useState<Omit<Track, "id"> | null>(null);
  const [isAddingSong, setIsAddingSong] = useState(false);

  // Edit Track State
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // Playlist Create/Edit State
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistForm, setPlaylistForm] = useState<{
    id?: string;
    name: string;
    description: string;
    bgLandscape: string;
    bgPortrait: string;
  }>({
    name: "",
    description: "",
    bgLandscape: "/bg/bg-video.mp4",
    bgPortrait: "/bg/Portrait-mobile.png",
  });

  // Background Upload State & Refs
  const [isUploadingBg, setIsUploadingBg] = useState<"landscape" | "portrait" | null>(null);
  const landscapeFileInputRef = useRef<HTMLInputElement | null>(null);
  const portraitFileInputRef = useRef<HTMLInputElement | null>(null);

  // Bulk Songs Import State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState("");
  const [targetBulkPlaylistId, setTargetBulkPlaylistId] = useState("");
  const [isParsingBulk, setIsParsingBulk] = useState(false);
  const [parsedSongs, setParsedSongs] = useState<
    Array<{
      title: string;
      artist: string;
      film: string;
      year: number;
      duration: string;
      videoId: string;
      selected: boolean;
    }>
  >([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Video Preview Modal
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  const notify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Open Bulk Modal
  const openBulkModal = (playlistId?: string) => {
    setTargetBulkPlaylistId(playlistId || selectedPlaylistId || (playlists[0]?.id ?? ""));
    setBulkInputText("");
    setParsedSongs([]);
    setIsBulkModalOpen(true);
  };

  // Parse bulk text and fetch metadata for each link
  const handleParseBulkSongs = async () => {
    if (!bulkInputText.trim()) return;
    setIsParsingBulk(true);

    const lines = bulkInputText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const results: Array<{
      title: string;
      artist: string;
      film: string;
      year: number;
      duration: string;
      videoId: string;
      selected: boolean;
    }> = [];

    for (const line of lines) {
      try {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/) || [line];
        const urlToFetch = urlMatch[0];

        let titleHint = "";
        if (line.includes(" - ")) {
          titleHint = line.split(" - ")[0].trim();
        } else if (line.includes("\t")) {
          titleHint = line.split("\t")[0].trim();
        }

        const res = await fetch("/api/admin/fetch-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlToFetch }),
        });
        const data = await res.json();

        if (res.ok && data.videoId) {
          results.push({
            title: titleHint || data.title || "Untitled Track",
            artist: data.artist || "Various Artists",
            film: data.film || "",
            year: data.year || new Date().getFullYear(),
            duration: data.duration || "4:00",
            videoId: data.videoId,
            selected: true,
          });
        }
      } catch (err) {
        console.error("Error parsing line:", line, err);
      }
    }

    if (results.length === 0) {
      notify("error", "Could not extract valid YouTube songs from input");
    } else {
      notify("success", `Parsed ${results.length} songs!`);
      setParsedSongs(results);
    }
    setIsParsingBulk(false);
  };

  // Save all selected parsed songs in bulk
  const handleSaveBulkSongs = async () => {
    const selected = parsedSongs.filter((s) => s.selected);
    if (selected.length === 0) {
      notify("error", "Please select at least one song to add");
      return;
    }
    const targetId = targetBulkPlaylistId || selectedPlaylistId;
    if (!targetId) {
      notify("error", "No target playlist selected");
      return;
    }

    setIsSavingBulk(true);
    try {
      const res = await fetch(`/api/playlists/${targetId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selected.map(({ selected: _, ...rest }) => rest),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        notify("success", `Successfully added ${data.count || selected.length} songs!`);
        setIsBulkModalOpen(false);
        setParsedSongs([]);
        setBulkInputText("");
        fetchPlaylists();
      } else {
        notify("error", data.error || "Failed to add songs");
      }
    } catch {
      notify("error", "Error adding songs in bulk");
    } finally {
      setIsSavingBulk(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "landscape" | "portrait") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBg(target);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", target);

      const res = await fetch("/api/admin/upload-bg", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.url) {
        if (target === "landscape") {
          setPlaylistForm((prev) => ({ ...prev, bgLandscape: data.url }));
        } else {
          setPlaylistForm((prev) => ({ ...prev, bgPortrait: data.url }));
        }
        notify("success", `Uploaded ${target} background!`);
      } else {
        notify("error", data.error || "Upload failed");
      }
    } catch {
      notify("error", "Failed to upload file");
    } finally {
      setIsUploadingBg(null);
      e.target.value = "";
    }
  };

  const checkSupabaseConnection = async () => {
    try {
      const res = await fetch("/api/supabase-test");
      const data = await res.json();
      setSupabaseConnected(!!data.connected);
    } catch {
      setSupabaseConnected(false);
    }
  };

  const checkAuth = async () => {
    try {
      setAuthStatus("loading");
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      if (data.authenticated) {
        setAuthStatus("authenticated");
        fetchPlaylists();
        checkSupabaseConnection();
      } else {
        setAuthStatus("unauthenticated");
      }
    } catch {
      setAuthStatus("unauthenticated");
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (data.playlists && Array.isArray(data.playlists)) {
        setPlaylists(data.playlists);
        if (!selectedPlaylistId && data.playlists.length > 0) {
          setSelectedPlaylistId(data.playlists[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load playlists", err);
      notify("error", "Failed to load playlists");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAuthStatus("authenticated");
        fetchPlaylists();
        checkSupabaseConnection();
      } else {
        setLoginError(data.error || "Invalid username or password");
      }
    } catch {
      setLoginError("Login failed. Check your network.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      setAuthStatus("unauthenticated");
      setUsername("");
      setPassword("");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  // Handle URL change for quick add
  const handleQuickUrlChange = async (url: string) => {
    setQuickYtUrl(url);
    if (!url.trim()) {
      setExtractedSong(null);
      return;
    }

    if (url.includes("youtu") || url.trim().length === 11) {
      setIsFetchingYt(true);
      try {
        const res = await fetch("/api/admin/fetch-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (res.ok && data.videoId) {
          setExtractedSong({
            title: data.title || "",
            artist: data.artist || "",
            film: data.film || "",
            year: data.year || new Date().getFullYear(),
            duration: data.duration || "4:00",
            videoId: data.videoId,
          });
        }
      } catch (err) {
        console.error("Error fetching YouTube info", err);
      } finally {
        setIsFetchingYt(false);
      }
    }
  };

  // Submit quick add
  const handleSaveExtractedSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedSong || !selectedPlaylistId) return;

    setIsAddingSong(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extractedSong),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        notify("success", `Added "${extractedSong.title}"`);
        setQuickYtUrl("");
        setExtractedSong(null);
        fetchPlaylists();
      } else {
        notify("error", data.error || "Failed to add song");
      }
    } catch {
      notify("error", "Error saving song");
    } finally {
      setIsAddingSong(false);
    }
  };

  // Update track details
  const handleUpdateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack || !selectedPlaylistId) return;

    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}/tracks/${editingTrack.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTrack),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        notify("success", "Song updated");
        setEditingTrack(null);
        fetchPlaylists();
      } else {
        notify("error", data.error || "Failed to update song");
      }
    } catch {
      notify("error", "Failed to update song");
    }
  };

  // Delete track
  const handleDeleteTrack = async (trackId: string, trackTitle: string) => {
    if (!confirm(`Remove "${trackTitle}" from playlist?`)) return;

    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}/tracks/${trackId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        notify("success", `Removed "${trackTitle}"`);
        fetchPlaylists();
      } else {
        notify("error", data.error || "Failed to remove song");
      }
    } catch {
      notify("error", "Failed to remove song");
    }
  };

  // Save Playlist (create or edit)
  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistForm.name.trim()) return;

    try {
      const isEdit = !!playlistForm.id;
      const url = isEdit ? `/api/playlists/${playlistForm.id}` : "/api/playlists";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlistForm),
      });
      const data = await res.json();

      if (res.ok && data.playlist) {
        notify("success", isEdit ? "Playlist updated" : "Playlist created");
        setIsPlaylistModalOpen(false);
        setSelectedPlaylistId(data.playlist.id);
        fetchPlaylists();
      } else {
        notify("error", data.error || "Failed to save playlist");
      }
    } catch {
      notify("error", "Failed to save playlist");
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async (playlistId: string, playlistName: string) => {
    if (!confirm(`Delete playlist "${playlistName}" and all its tracks?`)) return;

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok && data.success) {
        notify("success", `Deleted "${playlistName}"`);
        const remaining = playlists.filter((p) => p.id !== playlistId);
        setPlaylists(remaining);
        if (remaining.length > 0) setSelectedPlaylistId(remaining[0].id);
      } else {
        notify("error", data.error || "Failed to delete playlist");
      }
    } catch {
      notify("error", "Failed to delete playlist");
    }
  };

  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId) || playlists[0];

  const filteredTracks = activePlaylist
    ? activePlaylist.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.film.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  // Loading Screen
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Minimalist Login
  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="w-full max-w-sm p-8 rounded-2xl bg-[#121215] border border-white/10 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Kannada Kasthuri
            </h1>
            <p className="text-xs text-white/40 mt-1">Admin Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            {loginError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs text-center">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/20 text-xs focus:outline-none focus:border-white/30 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/20 text-xs focus:outline-none focus:border-white/30 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-2 px-4 rounded-lg bg-white hover:bg-neutral-200 text-black font-medium text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              ← Back to Music Player
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Minimalist Dashboard
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col selection:bg-white selection:text-black">
      {supabaseConnected === false && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs px-4 py-2.5 text-center font-medium flex items-center justify-center gap-2 select-none z-50">
          <span>⚠️ Warning: Supabase database is not connected. All changes are being saved to temporary local JSON files and will be lost on page refresh or container restart. Please configure the Supabase environment variables on Vercel.</span>
        </div>
      )}
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border text-xs font-medium backdrop-blur-md shadow-xl animate-in fade-in duration-150 ${notification.type === "success"
              ? "bg-[#18181b]/90 border-white/20 text-white"
              : "bg-red-950/90 border-red-500/30 text-red-200"
            }`}
        >
          {notification.message}
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 px-4 sm:px-8 py-3 bg-[#09090b]/80 border-b border-white/10 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1 font-medium"
          >
            ← Player
          </Link>
          <div className="h-3.5 w-px bg-white/10" />
          <span className="text-xs font-semibold text-white tracking-wide">
            Kannada Kasthuri <span className="text-[10px] text-white/40 font-normal ml-1">Admin</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openBulkModal()}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>⚡ Bulk Add Songs</span>
          </button>
          <button
            onClick={() => {
              setPlaylistForm({
                name: "",
                description: "",
                bgLandscape: "/bg/bg-video.mp4",
                bgPortrait: "/bg/Portrait-mobile.png",
              });
              setIsPlaylistModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            + New Playlist
          </button>
          <button
            onClick={handleLogout}
            className="text-xs text-white/40 hover:text-red-400 transition-colors cursor-pointer ml-1"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Quick Add from YouTube Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121215] border border-white/10 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Add Song via YouTube Link
            </h2>
            {activePlaylist && (
              <span className="text-xs text-white/40">
                Target: <span className="text-white font-medium">{activePlaylist.name}</span>
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={quickYtUrl}
              onChange={(e) => handleQuickUrlChange(e.target.value)}
              placeholder="Paste YouTube URL (e.g. https://youtu.be/UJLPaTAgQVQ or video ID)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/25 text-xs sm:text-sm focus:outline-none focus:border-white/30 transition-colors pr-10 font-mono"
            />
            {isFetchingYt && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              </div>
            )}
          </div>

          {/* Auto-extracted metadata form & preview */}
          {extractedSong && (
            <form onSubmit={handleSaveExtractedSong} className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-3">
                <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
                  <img
                    src={`https://img.youtube.com/vi/${extractedSong.videoId}/hqdefault.jpg`}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {extractedSong.title || "Untitled Song"}
                  </p>
                  <p className="text-[11px] text-white/50 truncate">
                    {extractedSong.artist || "Unknown Artist"} {extractedSong.film ? `• ${extractedSong.film}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Song Title</label>
                  <input
                    type="text"
                    required
                    value={extractedSong.title}
                    onChange={(e) => setExtractedSong({ ...extractedSong, title: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Artist</label>
                  <input
                    type="text"
                    value={extractedSong.artist}
                    onChange={(e) => setExtractedSong({ ...extractedSong, artist: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Film</label>
                  <input
                    type="text"
                    value={extractedSong.film}
                    onChange={(e) => setExtractedSong({ ...extractedSong, film: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Year</label>
                  <input
                    type="number"
                    value={extractedSong.year}
                    onChange={(e) => setExtractedSong({ ...extractedSong, year: parseInt(e.target.value, 10) || 1980 })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setExtractedSong(null);
                    setQuickYtUrl("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSong}
                  className="px-4 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-medium text-xs transition-colors cursor-pointer"
                >
                  {isAddingSong ? "Adding..." : `Add to ${activePlaylist?.name || "Playlist"}`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Playlist Selector & Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <div className="flex items-center gap-1.5">
              {playlists.map((pl) => {
                const isSelected = pl.id === selectedPlaylistId;
                return (
                  <button
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${isSelected
                        ? "bg-white text-black border-white font-semibold shadow-sm"
                        : "bg-[#121215] text-white/60 border-white/10 hover:text-white hover:bg-[#18181b]"
                      }`}
                  >
                    <span>{pl.name}</span>
                    <span className={`text-[10px] font-mono ${isSelected ? "text-black/60" : "text-white/40"}`}>
                      {pl.tracks.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {activePlaylist && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openBulkModal(activePlaylist.id)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                  title="Add multiple songs to this playlist"
                >
                  <span>⚡ Add Songs List</span>
                </button>
                <button
                  onClick={() => {
                    setPlaylistForm({
                      id: activePlaylist.id,
                      name: activePlaylist.name,
                      description: activePlaylist.description || "",
                      bgLandscape: activePlaylist.bgLandscape || "/bg/bg-video.mp4",
                      bgPortrait: activePlaylist.bgPortrait || "/bg/Portrait-mobile.png",
                    });
                    setIsPlaylistModalOpen(true);
                  }}
                  className="text-xs text-white/50 hover:text-white transition-colors cursor-pointer px-2 py-1"
                  title="Edit Playlist Details"
                >
                  Edit
                </button>
                {playlists.length > 1 && (
                  <button
                    onClick={() => handleDeletePlaylist(activePlaylist.id, activePlaylist.name)}
                    className="text-xs text-red-400/60 hover:text-red-400 transition-colors cursor-pointer px-2 py-1"
                    title="Delete Playlist"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search Filter inside active playlist */}
          {activePlaylist && activePlaylist.tracks.length > 5 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search among ${activePlaylist.tracks.length} songs in ${activePlaylist.name}...`}
              className="w-full px-3.5 py-2 rounded-xl bg-[#121215] border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-white/20 transition-colors"
            />
          )}
        </div>

        {/* Tracks Table */}
        {activePlaylist && (
          <div className="rounded-2xl bg-[#121215] border border-white/10 overflow-hidden shadow-sm">
            {filteredTracks.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40">
                {activePlaylist.tracks.length === 0
                  ? "No songs in this playlist yet. Paste a YouTube link above to add one."
                  : "No songs match your search query."}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 sm:px-4 hover:bg-white/[0.02] transition-colors group text-left"
                  >
                    {/* Index */}
                    <span className="w-5 text-center text-xs text-white/30 font-mono shrink-0">
                      {idx + 1}
                    </span>

                    {/* Thumbnail with Play preview */}
                    <div
                      onClick={() => setPreviewVideoId(track.videoId)}
                      className="relative w-14 sm:w-16 aspect-video rounded-md overflow-hidden bg-black border border-white/10 shrink-0 cursor-pointer group/thumb"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-xs">▶</span>
                      </div>
                    </div>

                    {/* Song Details */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-medium text-white truncate">
                          {track.title}
                        </h3>
                        {track.year && (
                          <span className="text-[10px] font-mono text-white/40">
                            ({track.year})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">
                        {track.artist} {track.film ? `• ${track.film}` : ""}
                      </p>
                    </div>

                    {/* Duration & Video ID */}
                    <div className="hidden sm:flex flex-col items-end shrink-0 text-right pr-2">
                      <span className="text-xs font-mono text-white/50">{track.duration || "4:00"}</span>
                      <a
                        href={`https://youtu.be/${track.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-white/30 hover:text-white/70 font-mono transition-colors"
                      >
                        {track.videoId}
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingTrack(track)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-xs"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(track.id, track.title)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-xs"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Edit Track */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-2xl bg-[#121215] border border-white/15 shadow-2xl animate-in fade-in duration-100 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Edit Song</h3>
              <button
                onClick={() => setEditingTrack(null)}
                className="text-white/40 hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTrack} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingTrack.title}
                  onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Artist</label>
                  <input
                    type="text"
                    value={editingTrack.artist}
                    onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Film</label>
                  <input
                    type="text"
                    value={editingTrack.film}
                    onChange={(e) => setEditingTrack({ ...editingTrack, film: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Year</label>
                  <input
                    type="number"
                    value={editingTrack.year}
                    onChange={(e) => setEditingTrack({ ...editingTrack, year: parseInt(e.target.value, 10) || 1980 })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">Duration</label>
                  <input
                    type="text"
                    value={editingTrack.duration}
                    onChange={(e) => setEditingTrack({ ...editingTrack, duration: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/50 mb-1">YouTube ID</label>
                  <input
                    type="text"
                    required
                    value={editingTrack.videoId}
                    onChange={(e) => setEditingTrack({ ...editingTrack, videoId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrack(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-white text-black font-medium text-xs hover:bg-neutral-200 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Playlist */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-[#121215] border border-white/15 shadow-2xl animate-in fade-in duration-100 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">
                {playlistForm.id ? "Edit Playlist" : "New Playlist"}
              </h3>
              <button
                onClick={() => setIsPlaylistModalOpen(false)}
                className="text-white/40 hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlaylist} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={playlistForm.name}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                  placeholder="e.g. Romantic Hits"
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-[10px] text-white/50 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={playlistForm.description}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                  placeholder="Short description..."
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={landscapeFileInputRef}
                className="hidden"
                accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={(e) => handleFileUpload(e, "landscape")}
              />
              <input
                type="file"
                ref={portraitFileInputRef}
                className="hidden"
                accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={(e) => handleFileUpload(e, "portrait")}
              />

              {/* Landscape Background (Desktop) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-medium text-white/70">
                    Landscape Background (Desktop)
                  </label>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                    {isVideoUrl(playlistForm.bgLandscape) ? "Video" : "Image"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={playlistForm.bgLandscape}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, bgLandscape: e.target.value })}
                    placeholder="/bg/bg-video.mp4 or Image/Video URL"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={isUploadingBg === "landscape"}
                    onClick={() => landscapeFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploadingBg === "landscape" ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>📁 Upload</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, bgLandscape: "/bg/bg-video.mp4" })}
                    className="px-2 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Reset to default landscape video"
                  >
                    Default
                  </button>
                </div>

                {/* Landscape Live Mini-Preview */}
                {playlistForm.bgLandscape && (
                  <div className="relative w-full h-20 rounded-lg overflow-hidden bg-black/60 border border-white/10 mt-1 flex items-center justify-center">
                    {isVideoUrl(playlistForm.bgLandscape) ? (
                      <video
                        src={playlistForm.bgLandscape}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={playlistForm.bgLandscape}
                        alt="Landscape Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white/70 font-mono">
                      16:9 Preview
                    </div>
                  </div>
                )}
              </div>

              {/* Portrait Background (Mobile) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-medium text-white/70">
                    Portrait Background (Mobile)
                  </label>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">
                    {isVideoUrl(playlistForm.bgPortrait) ? "Video" : "Image"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={playlistForm.bgPortrait}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, bgPortrait: e.target.value })}
                    placeholder="/bg/Portrait-mobile.png or Image/Video URL"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={isUploadingBg === "portrait"}
                    onClick={() => portraitFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploadingBg === "portrait" ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>📁 Upload</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, bgPortrait: "/bg/Portrait-mobile.png" })}
                    className="px-2 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Reset to default portrait image"
                  >
                    Default
                  </button>
                </div>

                {/* Portrait Live Mini-Preview */}
                {playlistForm.bgPortrait && (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-black/60 border border-white/10 mt-1 flex items-center justify-center">
                    {isVideoUrl(playlistForm.bgPortrait) ? (
                      <video
                        src={playlistForm.bgPortrait}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={playlistForm.bgPortrait}
                        alt="Portrait Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white/70 font-mono">
                      9:16
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-white text-black font-medium text-xs hover:bg-neutral-200 cursor-pointer"
                >
                  {playlistForm.id ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Songs Import */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-5 sm:p-6 rounded-2xl bg-[#121215] border border-white/15 shadow-2xl animate-in fade-in duration-100 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-sm">⚡</span>
                <h3 className="text-sm font-semibold text-white">Add Songs List (Bulk Import)</h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-white/40 hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-3.5 pr-1 scrollbar-thin">
              {/* Target Playlist Selector */}
              <div>
                <label className="block text-[11px] font-medium text-white/70 mb-1">
                  Target Playlist
                </label>
                <select
                  value={targetBulkPlaylistId}
                  onChange={(e) => setTargetBulkPlaylistId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id} className="bg-[#121215] text-white">
                      {pl.name} ({pl.tracks.length} songs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea for song list / URLs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-white/70">
                    Paste YouTube Song Links or Song Names
                  </label>
                  <span className="text-[10px] text-white/40">One per line</span>
                </div>
                <textarea
                  rows={6}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`https://youtu.be/UJLPaTAgQVQ\nhttps://youtu.be/GMeix2XBAqE\nPremada Kadambari - https://youtu.be/Gy5Tf4if_ww\nhttps://www.youtube.com/watch?v=kmQ3af5Nmik`}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 font-mono resize-none placeholder-white/20"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/40">
                  {parsedSongs.length > 0
                    ? `${parsedSongs.filter((s) => s.selected).length} of ${parsedSongs.length} songs selected`
                    : "Click analyze to fetch song titles and metadata automatically"}
                </p>
                <button
                  type="button"
                  disabled={isParsingBulk || !bulkInputText.trim()}
                  onClick={handleParseBulkSongs}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  {isParsingBulk ? (
                    <>
                      <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Fetching metadata...</span>
                    </>
                  ) : (
                    <span>🔍 Parse & Fetch Song Details</span>
                  )}
                </button>
              </div>

              {/* Parsed Songs Review Table */}
              {parsedSongs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white/80">Parsed Songs Review</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = parsedSongs.every((s) => s.selected);
                        setParsedSongs(parsedSongs.map((s) => ({ ...s, selected: !allSelected })));
                      }}
                      className="text-[11px] text-white/50 hover:text-white"
                    >
                      {parsedSongs.every((s) => s.selected) ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 overflow-hidden max-h-56 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                    {parsedSongs.map((song, i) => (
                      <div
                        key={i}
                        className={`p-2.5 flex items-center gap-2.5 text-xs transition-colors ${song.selected ? "bg-white/[0.03]" : "opacity-45 bg-black/40"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={song.selected}
                          onChange={(e) => {
                            const updated = [...parsedSongs];
                            updated[i].selected = e.target.checked;
                            setParsedSongs(updated);
                          }}
                          className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <div className="w-12 aspect-video rounded bg-black border border-white/10 overflow-hidden shrink-0">
                          <img
                            src={`https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            value={song.title}
                            onChange={(e) => {
                              const updated = [...parsedSongs];
                              updated[i].title = e.target.value;
                              setParsedSongs(updated);
                            }}
                            placeholder="Title"
                            className="px-2 py-1 rounded bg-black/50 border border-white/10 text-white text-[11px] truncate focus:outline-none"
                          />
                          <input
                            type="text"
                            value={song.artist}
                            onChange={(e) => {
                              const updated = [...parsedSongs];
                              updated[i].artist = e.target.value;
                              setParsedSongs(updated);
                            }}
                            placeholder="Artist"
                            className="px-2 py-1 rounded bg-black/50 border border-white/10 text-white/80 text-[11px] truncate focus:outline-none"
                          />
                          <input
                            type="text"
                            value={song.film}
                            onChange={(e) => {
                              const updated = [...parsedSongs];
                              updated[i].film = e.target.value;
                              setParsedSongs(updated);
                            }}
                            placeholder="Film"
                            className="px-2 py-1 rounded bg-black/50 border border-white/10 text-white/80 text-[11px] truncate focus:outline-none"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-white/40 shrink-0">
                          {song.videoId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingBulk || parsedSongs.filter((s) => s.selected).length === 0}
                onClick={handleSaveBulkSongs}
                className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                {isSavingBulk ? (
                  <span>Adding songs...</span>
                ) : (
                  <span>
                    Add {parsedSongs.filter((s) => s.selected).length} Songs to Playlist
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: YouTube Video Preview */}
      {previewVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xl bg-black rounded-2xl overflow-hidden border border-white/15 shadow-2xl relative">
            <button
              onClick={() => setPreviewVideoId(null)}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-xs cursor-pointer"
            >
              ✕
            </button>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
