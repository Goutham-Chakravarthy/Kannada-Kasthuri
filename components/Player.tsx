"use client";

import React, { useState, useEffect, useRef } from "react";
import { tracks, Track, playlists, PlaylistInfo, shuffleTrackList } from "@/app/tracks";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { track } from "@vercel/analytics";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

// Declarations for YouTube iframe API
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

// Module-level Sub-components
const Clock: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format time: e.g., "6:34 pm"
      const formattedTime = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now).toLowerCase();

      // Format date: e.g., "WEDNESDAY, 12 AUGUST"
      const formattedDate = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now).toUpperCase();

      setTimeStr(formattedTime);
      setDateStr(`${formattedDate} · IST`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  return (
    <div className="flex flex-col text-left drop-shadow-md select-none">
      <div className="text-xl sm:text-2xl font-light tracking-wide text-white leading-none">
        {timeStr}
      </div>
      <div className="text-[9px] sm:text-[10px] font-semibold text-white/50 tracking-widest uppercase mt-1">
        {dateStr}
      </div>
    </div>
  );
};

interface SeekProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const SeekBar: React.FC<SeekProps> = ({ currentTime, duration, onSeek }) => {
  const barRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!barRef.current || duration === 0) return;
    const rect = barRef.current.getBoundingClientRect();

    const updateSeek = (clientX: number) => {
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = x / rect.width;
      onSeek(pct * duration);
    };

    updateSeek(e.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateSeek(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      className="relative w-full h-3.5 flex items-center cursor-pointer touch-none group/seek"
    >
      {/* Invisible hit area */}
      <div className="absolute inset-0 h-full" />

      {/* Visible rail (3px) */}
      <div className="w-full h-[3px] rounded-full bg-white/20 relative overflow-visible">
        {/* Track fill */}
        <div
          className="absolute top-0 left-0 h-full bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]"
          style={{ width: `${pct}%` }}
        />
        {/* Knob */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -ml-1 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === null) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

// Main Component
interface PlayerProps {
  initialTracks?: Track[];
  initialPlaylists?: PlaylistInfo[];
  initialOnlineCount?: number;
}

export const Player: React.FC<PlayerProps> = ({
  initialTracks,
  initialPlaylists,
  initialOnlineCount = 1,
}) => {
  const [allPlaylists, setAllPlaylists] = useState<PlaylistInfo[]>(() =>
    initialPlaylists && initialPlaylists.length > 0
      ? initialPlaylists
      : playlists.map((pl) => ({ ...pl, tracks: shuffleTrackList(pl.tracks) }))
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(() =>
    initialPlaylists && initialPlaylists.length > 0 ? initialPlaylists[0].id : "evergreen"
  );
  const activePlaylist = allPlaylists.find((p) => p.id === selectedPlaylistId) || allPlaylists[0] || playlists[0];
  const [playlist, setPlaylist] = useState<Track[]>(() =>
    initialTracks && initialTracks.length > 0
      ? initialTracks
      : activePlaylist?.tracks && activePlaylist.tracks.length > 0
        ? activePlaylist.tracks
        : tracks
  );
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(() => Math.max(1, initialOnlineCount || 1));
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  const handleSelectPlaylist = (targetPlaylist: PlaylistInfo) => {
    if (targetPlaylist.id !== selectedPlaylistId) {
      setSelectedPlaylistId(targetPlaylist.id);
      const shuffledTracks = shuffleTrackList(targetPlaylist.tracks || []);
      setPlaylist(shuffledTracks);
      setAllPlaylists((prev) =>
        prev.map((p) => (p.id === targetPlaylist.id ? { ...p, tracks: shuffledTracks } : p))
      );
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    }
  };

  // Sync playlists from backend periodically/on-mount & subscribe to Supabase Realtime changes
  useEffect(() => {
    const syncPlaylists = async () => {
      try {
        const res = await fetch("/api/playlists");
        const data = await res.json();
        if (data.playlists && Array.isArray(data.playlists) && data.playlists.length > 0) {
          setAllPlaylists((prev) => {
            return data.playlists.map((newPl: PlaylistInfo) => {
              const existing = prev.find((p) => p.id === newPl.id);
              // Preserve session's shuffled order if track count and tracks are unchanged
              if (existing && existing.tracks.length === newPl.tracks.length) {
                const newIds = new Set(newPl.tracks.map((t) => t.id));
                const allMatch = existing.tracks.every((t) => newIds.has(t.id));
                if (allMatch) {
                  return { ...newPl, tracks: existing.tracks };
                }
              }
              // If new playlist or track list changed in admin, shuffle the tracks
              return { ...newPl, tracks: shuffleTrackList(newPl.tracks) };
            });
          });
        }
      } catch (e) {
        console.error("Failed to sync playlists", e);
      }
    };

    syncPlaylists();

    // Setup Supabase Realtime subscription if credentials are present
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let channel: RealtimeChannel | null = null;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient();
        channel = supabase
          .channel("realtime-playlists")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "playlists",
            },
            () => {
              syncPlaylists();
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Failed to setup Supabase Realtime:", err);
      }
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch (err) {
          // ignore
        }
      }
    };
  }, []);

  // Sync the currently playing track list (playlist state) if the active playlist's tracks change in allPlaylists
  useEffect(() => {
    const active = allPlaylists.find((p) => p.id === selectedPlaylistId);
    if (active && active.tracks) {
      const currentTrackIds = playlist.map((t) => t.id).join(",");
      const activeTrackIds = active.tracks.map((t) => t.id).join(",");
      if (currentTrackIds !== activeTrackIds) {
        const currentTrack = playlist[currentTrackIndex];
        let newIndex = 0;
        if (currentTrack) {
          const idx = active.tracks.findIndex((t) => t.id === currentTrack.id);
          if (idx !== -1) {
            newIndex = idx;
          }
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlaylist(active.tracks);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentTrackIndex(newIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlaylists, selectedPlaylistId]);


  // Playback options states
  const [playOnce, setPlayOnce] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerId = "youtube-player-element";
  const activeTrack = playlist[currentTrackIndex] || playlist[0] || tracks[0];

  const playRandomMemory = () => {
    let randomIndex = Math.floor(Math.random() * playlist.length);
    if (randomIndex === currentTrackIndex && playlist.length > 1) {
      randomIndex = (randomIndex + 1) % playlist.length;
    }
    setCurrentTrackIndex(randomIndex);
    setIsPlaying(true);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      if (typeof playerRef.current.unMute === "function") playerRef.current.unMute();
      setIsMuted(false);
    } else {
      if (typeof playerRef.current.mute === "function") playerRef.current.mute();
      setIsMuted(true);
    }
  };

  // Ref trackers to prevent stale closures in event listener callbacks
  const playOnceRef = useRef(playOnce);

  useEffect(() => {
    playOnceRef.current = playOnce;
  }, [playOnce]);

  // Real-time active online user tracking
  useEffect(() => {
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("kk_session_id") || "";
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("kk_session_id", sessionId);
      }
    } catch {
      sessionId = `sess_${Date.now()}`;
    }

    const pingOnline = async () => {
      try {
        const res = await fetch(`/api/online?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (typeof data.online === "number") {
          setOnlineCount(data.online);
        }
      } catch (err) {
        console.warn("Failed to ping online presence", err);
      }
    };

    pingOnline();
    const timer = setInterval(pingOnline, 10000);

    const handleUnload = () => {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ sessionId, action: "leave" })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/online", blob);
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  // Handle progress updates
  const startTrackingProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time || 0);
      }
    }, 400);
  };

  const stopTrackingProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Next and Prev track logic
  const handleNext = () => {
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
  };

  const handlePrev = () => {
    setCurrentTrackIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  };

  // Load YouTube Player API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initYT = () => {
      playerRef.current = new window.YT.Player(containerId, {
        height: "100%",
        width: "100%",
        videoId: activeTrack.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            setDuration(event.target.getDuration() || 0);
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 1 (PLAYING), 2 (PAUSED), 0 (ENDED)
            if (event.data === 1) {
              setIsPlaying(true);
              setDuration(playerRef.current.getDuration() || 0);
              startTrackingProgress();
            } else if (event.data === 2) {
              setIsPlaying(false);
              stopTrackingProgress();
            } else if (event.data === 0) {
              if (playOnceRef.current) {
                setIsPlaying(false);
                stopTrackingProgress();
              } else {
                handleNext();
              }
            }
          },
          onError: (event: any) => {
            console.error("YouTube Player Error code:", event.data, "for videoId:", activeTrack.videoId);
            track("VideoPlayError", { videoId: activeTrack.videoId, errorCode: event.data });
            // Auto skip unplayable / embed-restricted videos
            setTimeout(() => {
              handleNext();
            }, 800);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initYT();
      };
    }

    return () => {
      stopTrackingProgress();
    };
  }, []);

  // Update track whenever activeTrack.videoId changes (prev/next or playlist switch)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(activeTrack.videoId);
      setIsPlaying(true);
    }
  }, [activeTrack.videoId]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        if (typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
      } else {
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        } else if (typeof playerRef.current.loadVideoById === "function") {
          playerRef.current.loadVideoById(activeTrack.videoId);
        }
      }
    } catch (e) {
      console.error("togglePlay error", e);
    }
  };

  const seek = (time: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(time, true);
      setCurrentTime(time);
    }
  };

  // Desktop keyboard shortcuts: Space (Play/Pause), ArrowRight (Next), ArrowLeft (Prev), M (Mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing in an input field, textarea, or editable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.code === "KeyM" || e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, isMuted, playlist.length, activeTrack.videoId]);

  const playlistRef = useRef<HTMLDivElement | null>(null);

  // Click outside to close playlist popover
  useEffect(() => {
    if (!isPlaylistOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (playlistRef.current && !playlistRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-playlist-toggle]")) return;
        setIsPlaylistOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isPlaylistOpen]);

  return (
    <>
      {/* Dynamic Background reactive to active playlist */}
      <BackgroundVideo
        src={activePlaylist.bgLandscape || "/bg/bg-video.mp4"}
        portraitImage={activePlaylist.bgPortrait || "/bg/Portrait-mobile.png"}
      />

      {/* Top row - fixed corners */}
      <header className="fixed top-0 inset-x-0 flex items-center justify-between select-none z-30 px-[max(1rem,env(safe-area-inset-left))] py-[max(1.2rem,env(safe-area-inset-top))]">
        {/* Clock top-left */}
        <Clock />

        {/* Listener count top-center */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 border border-white/10 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium tracking-wide text-white/90 font-mono">
            {onlineCount.toLocaleString()} online
          </span>
        </div>

        {/* Balance spacer for top-right so online pill stays centered */}
        <div className="w-24 hidden sm:block pointer-events-none" />
      </header>

      {/* Main Bottom Player Container */}
      <div className="pointer-events-auto relative flex flex-col items-center gap-2.5 sm:gap-3 w-full max-w-[620px] sm:max-w-[660px] px-3 sm:px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-20 mt-auto select-none">
        {/* Glassmorphic Playlist Popover directly above player */}
        {isPlaylistOpen && (
          <div
            ref={playlistRef}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[calc(100%-1.5rem)] sm:w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-black/50 backdrop-blur-xl z-30 flex flex-col max-h-[50vh] sm:max-h-[58vh] text-left p-3.5 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Playlist Tabs Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/10 mb-3">
              {allPlaylists.map((pl) => {
                const isSelected = pl.id === selectedPlaylistId;
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleSelectPlaylist(pl)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs sm:text-[13px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${isSelected
                      ? "bg-white/20 text-white shadow-sm border border-white/15 font-semibold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <span>{pl.name}</span>
                    <span className="text-[10px] font-mono opacity-65">({pl.tracks.length})</span>
                  </button>
                );
              })}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-2 pt-0.5 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-white/95 text-xs sm:text-sm font-semibold tracking-wide truncate">
                  {activePlaylist.name}
                </h2>
                <span className="text-[11px] sm:text-xs text-white/45 font-mono shrink-0">
                  • {playlist.length} songs
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const shuffled = shuffleTrackList(playlist);
                    setPlaylist(shuffled);
                    setAllPlaylists((prev) =>
                      prev.map((p) => (p.id === selectedPlaylistId ? { ...p, tracks: shuffled } : p))
                    );
                    setCurrentTrackIndex(0);
                    setIsPlaying(true);
                  }}
                  className="text-white/60 hover:text-white transition-colors p-1.5 cursor-pointer rounded-full hover:bg-white/10"
                  title="Shuffle Playlist"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M4.5 12a48.563 48.563 0 00-.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsPlaylistOpen(false)}
                  className="text-white/50 hover:text-white transition-colors p-1 -mr-1 cursor-pointer rounded-full hover:bg-white/10"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1.5 scrollbar-thin">
              {playlist.map((trackItem, index) => {
                const isActive = index === currentTrackIndex;
                return (
                  <div
                    key={trackItem.id}
                    onClick={() => {
                      setCurrentTrackIndex(index);
                      setIsPlaying(true);
                    }}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                      }`}
                  >
                    {/* Track Number */}
                    <span className={`w-5 text-center text-xs font-normal shrink-0 ${isActive ? "text-white font-medium" : "text-white/45"}`}>
                      {index + 1}
                    </span>

                    {/* Track Title & Artist */}
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className={`text-[13px] sm:text-sm font-medium truncate leading-tight ${isActive ? "text-white font-semibold" : "text-white/90"}`}>
                        {trackItem.title}
                      </h4>
                      <p className={`text-[11px] sm:text-xs truncate mt-0.5 font-normal ${isActive ? "text-white/75" : "text-white/50"}`}>
                        {trackItem.artist}
                      </p>
                    </div>

                    {/* Duration */}
                    <span className={`text-xs font-mono shrink-0 select-none ${isActive ? "text-white/85" : "text-white/45"}`}>
                      {trackItem.duration || "4:00"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Separate Floating Playlist Capsules (No icons) */}
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 select-none">
          {allPlaylists.map((pl) => {
            const isSelected = pl.id === selectedPlaylistId;
            return (
              <button
                key={pl.id}
                onClick={() => {
                  if (pl.id !== selectedPlaylistId) {
                    handleSelectPlaylist(pl);
                  } else {
                    setIsPlaylistOpen((prev) => !prev);
                  }
                }}
                className={`px-4.5 sm:px-5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-all cursor-pointer shadow-xl backdrop-blur-xl active:scale-95 border ${isSelected
                  ? "bg-white/20 text-white border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)] font-semibold scale-[1.02]"
                  : "bg-black/50 text-white/75 border-white/15 hover:text-white hover:bg-black/65 hover:border-white/25"
                  }`}
              >
                {pl.name}
              </button>
            );
          })}
        </div>

        {/* Capsule Pill Bar */}
        <div className="capsule-player rounded-full w-full p-2.5 sm:p-3 pl-2.5 sm:pl-3.5 pr-4 sm:pr-5 flex items-center gap-3 sm:gap-4 shadow-2xl relative overflow-hidden">
          {/* 1. Left: Spinning Vinyl / CD Album Artwork */}
          <div className="relative w-13 h-13 sm:w-16 sm:h-16 rounded-full shrink-0 overflow-hidden shadow-lg border border-white/20 select-none group">
            <div
              className={`w-full h-full rounded-full overflow-hidden transition-transform duration-700 ${isPlaying ? "animate-spin-vinyl" : ""
                }`}
              style={{ animationDuration: "12s" }}
            >
              <img
                src={`https://img.youtube.com/vi/${activeTrack.videoId}/hqdefault.jpg`}
                alt={activeTrack.title}
                className="w-full h-full object-cover scale-125"
                loading="lazy"
              />
              {/* Vinyl concentric groove texture effect */}
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_25%,rgba(0,0,0,0.2)_35%,transparent_45%,rgba(255,255,255,0.08)_55%,transparent_65%,rgba(0,0,0,0.3)_80%)] pointer-events-none" />
            </div>

            {/* Center Spindle Hole */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#141416] border border-neutral-600 shadow-inner z-10 pointer-events-none" />
          </div>

          {/* 2. Middle: Track Info & Seekbar & Time */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm md:text-[15px] font-semibold text-white truncate leading-tight tracking-wide">
                {activeTrack.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-white/70 truncate mt-0.5 font-normal">
                {activeTrack.artist}
              </p>
            </div>

            {/* Seekbar */}
            <div className="w-full mt-1.5">
              <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />

              {/* Time display */}
              <div className="text-[10px] sm:text-[11px] font-mono text-white/55 tracking-wider -mt-0.5 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* 3. Right: Control Buttons */}
          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0">
            {/* Volume / Mute Button (hidden on small mobile, visible on desktop) */}
            <button
              onClick={toggleMute}
              className="hidden sm:flex p-2 text-white/75 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/5 active:scale-95"
              title={isMuted ? "Unmute (M)" : "Mute (M)"}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H4v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Prev Track Button */}
            <button
              onClick={handlePrev}
              className="p-2 sm:p-2 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
              title="Previous (Left Arrow)"
            >
              <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            {/* Big Play / Pause Circle */}
            <button
              onClick={togglePlay}
              className="w-11 h-11 sm:w-12 sm:h-12 bg-white hover:bg-neutral-100 text-black rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-black translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next Track Button */}
            <button
              onClick={handleNext}
              className="p-2 sm:p-2 text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
              title="Next (Right Arrow)"
            >
              <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z" />
              </svg>
            </button>

            {/* Playlist / Queue Button */}
            <button
              data-playlist-toggle="true"
              onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
              className={`p-2 sm:p-2 rounded-full transition-colors cursor-pointer active:scale-95 ${isPlaylistOpen ? "text-white bg-white/20" : "text-white/75 hover:text-white hover:bg-white/5"
                }`}
              title="Playlist"
            >
              <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Off-screen YouTube Player Target for Audio Playback with proper dimensions */}
      <div
        className="fixed -left-[9999px] -top-[9999px] w-[320px] h-[240px] pointer-events-none opacity-[0.001]"
        aria-hidden="true"
      >
        <div id={containerId} />
      </div>
    </>
  );
};
