"use client";

import React, { useState, useEffect, useRef } from "react";
import { tracks, Track } from "@/app/tracks";
import { track } from "@vercel/analytics";

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
      className="relative w-full h-6 flex items-center cursor-pointer touch-none group/seek"
    >
      {/* Invisible larger hit area (24px) */}
      <div className="absolute inset-0 h-6" />
      
      {/* Visible rail (3px) */}
      <div className="w-full h-[3px] rounded-full bg-white/15 relative overflow-visible">
        {/* Track fill with soft glow */}
        <div
          className="absolute top-0 left-0 h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          style={{ width: `${pct}%` }}
        />
        {/* Knob visible on hover only */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-white border border-white opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
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
export const Player: React.FC = () => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [onlineCount, setOnlineCount] = useState(86697);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  // Playback options states
  const [isShuffle, setIsShuffle] = useState(false);
  const [playOnce, setPlayOnce] = useState(false);

  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerId = "youtube-player-element";
  const activeTrack = tracks[currentTrackIndex];

  // Ref trackers to prevent stale closures in event listener callbacks
  const isShuffleRef = useRef(isShuffle);
  const playOnceRef = useRef(playOnce);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    playOnceRef.current = playOnce;
  }, [playOnce]);

  // Fetch real online count
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/online");
        const data = await res.json();
        if (typeof data.online === "number") {
          setOnlineCount(data.online);
        }
      } catch (err) {
        console.error("Failed to fetch online count", err);
      }
    };

    fetchOnline();
    const timer = setInterval(fetchOnline, 10000);
    return () => clearInterval(timer);
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
    if (isShuffleRef.current) {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex(prev => (prev + 1) % tracks.length);
    }
  };

  const handlePrev = () => {
    if (isShuffleRef.current) {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length);
    }
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
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            setDuration(event.target.getDuration() || 0);
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
            console.error("YouTube Player Error", event.data);
            track("VideoPlayError", { videoId: activeTrack.videoId, errorCode: event.data });
            handleNext();
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

  // Update track when index changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(activeTrack.videoId);
      setIsPlaying(true);
    }
  }, [currentTrackIndex]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const seek = (time: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(time, true);
      setCurrentTime(time);
    }
  };

  return (
    <>
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

        {/* Top-right corner label */}
        <div className="flex items-center gap-4 text-sm font-bold drop-shadow-md text-amber-200/90 font-serif">
          ಕನ್ನಡ ಕಸ್ತೂರಿ
        </div>
      </header>

      {/* Kannada Landing Page Overlay */}
      {!hasInteracted && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-sm transition-all duration-500">
          {/* Logo Badge / Spinning Vinyl Style */}
          <div className="w-24 h-24 rounded-full bg-black/60 border border-white/10 flex items-center justify-center shadow-2xl mb-8 relative group cursor-pointer animate-spin-vinyl">
            <span className="text-4xl select-none">📻</span>
            <div className="absolute inset-0 rounded-full border border-amber-500/30 animate-ping" style={{ animationDuration: '3s' }} />
          </div>

          {/* Kannada Title */}
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-wide text-amber-50 font-serif mb-2 drop-shadow-lg">
            ಕನ್ನಡ ಕಸ್ತೂರಿ
          </h1>
          <p className="text-xs font-semibold tracking-widest text-amber-400/80 font-mono uppercase mb-8 select-none">
            Kannada Kasthuri
          </p>

          {/* Subtext / Description */}
          <p className="text-sm sm:text-base text-white/80 max-w-md leading-relaxed mb-10 px-4">
            ನಮಸ್ಕಾರ — ಕನ್ನಡ ಕಸ್ತೂರಿಗೆ ಸುಸ್ವಾಗತ. <br />
            <span className="text-white/60 text-xs sm:text-sm mt-2 block font-serif">
              ಚಹಾದ ಸವಿಯೊಂದಿಗೆ ಹಳೆಯ ಮಧುರ ಕನ್ನಡ ಗೀತೆಗಳ ಸವಾರಿ.
            </span>
          </p>

          {/* Play / Enter Button */}
          <button
            onClick={() => {
              setHasInteracted(true);
              togglePlay();
            }}
            className="flex items-center gap-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full p-2 pr-6 cursor-pointer transform active:scale-95 transition-all shadow-xl hover:shadow-amber-500/10 group"
          >
            <div className="w-12 h-12 bg-gradient-to-b from-amber-500 to-orange-700 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(245,158,11,0.4)] group-hover:from-amber-400 group-hover:to-orange-600 transition-colors">
              <svg className="w-6 h-6 text-white translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white tracking-wide">ರೇಡಿಯೋ ಆನ್ ಮಾಡಿ</div>
              <div className="text-[10px] text-white/50 font-semibold uppercase">Plays Out Loud</div>
            </div>
          </button>

          {/* Footnote */}
          <p className="text-[10px] text-white/40 max-w-xs mt-8 leading-normal select-none">
            ಪ್ಲೇ ಒತ್ತಿದ ನಂತರ ಆಡಿಯೋ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ. ಸ್ಪೇಸ್ ಬಾರ್ ಅಥವಾ ಕ್ಲಿಕ್ ಬಳಸಿ ಪ್ಲೇ/ಪಾಸ್ ಮಾಡಬಹುದು.
          </p>
        </div>
      )}

      {/* Central Retro Title Section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center select-none px-4 mt-20 sm:mt-24">
        {/* Retro play badge above the title */}
        <div 
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-neutral-900/80 border border-white/15 flex items-center justify-center shadow-2xl mb-6 relative group cursor-pointer transition-transform duration-300 hover:scale-105"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center shadow-md">
            {isPlaying ? (
              <span className="w-4 h-4 flex gap-1 justify-center items-center">
                <span className="w-1 h-4 bg-white rounded-full animate-pulse" />
                <span className="w-1 h-3 bg-white rounded-full animate-pulse [animation-delay:0.2s]" />
                <span className="w-1 h-4 bg-white rounded-full animate-pulse [animation-delay:0.4s]" />
              </span>
            ) : (
              <svg className="w-5 h-5 text-white translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
          <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
        </div>

        {/* Styled Kannada Retro Title */}
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-wide text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] font-serif relative">
          <span className="bg-gradient-to-b from-amber-100 via-amber-200 to-orange-100 bg-clip-text text-transparent filter drop-shadow-[0_2px_4px_rgba(251,191,36,0.4)]">
            ಕನ್ನಡ ಕಸ್ತೂರಿ
          </span>
        </h1>

        {/* English Subtitle */}
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.35em] text-amber-500/90 font-mono uppercase mt-3 drop-shadow-md">
          KANNADA KASTHURI
        </p>

        {/* Now Playing Badge */}
        <div className="mt-6 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 backdrop-blur-md flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-white/50 uppercase font-mono">
            NOW PLAYING
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-amber-200 font-serif">
            {activeTrack.film}
          </span>
        </div>
      </div>

      {/* Main player box wrapper */}
      <div className="relative w-full max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] z-20 mt-auto">
        <div className="flex flex-col gap-4 rounded-[28px] p-5 glass-panel relative w-full">
          {/* Main Info Row (Thumbnail + Details + Quick Links) */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            {/* Thumbnail Box */}
            <div className="relative w-full sm:w-40 aspect-video rounded-2xl bg-neutral-950 border border-white/10 overflow-hidden shrink-0 shadow-inner group">
              <img
                src={`https://img.youtube.com/vi/${activeTrack.videoId}/mqdefault.jpg`}
                alt={activeTrack.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Overlay shadow to look premium */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </div>

            {/* Song Info & External Links */}
            <div className="flex-1 min-w-0 w-full text-center sm:text-left flex flex-col justify-between h-full py-1">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white truncate tracking-wide leading-tight">
                  {activeTrack.title}
                </h3>
                <p className="text-xs sm:text-sm text-amber-200/80 truncate mt-1">
                  {activeTrack.artist}
                </p>
                <p className="text-[11px] text-white/40 truncate mt-0.5 font-mono">
                  {activeTrack.film} ({activeTrack.year})
                </p>
              </div>

              {/* Action Buttons (Spotify / YT Music / YouTube) */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3.5">
                <a
                  href={`https://music.youtube.com/watch?v=${activeTrack.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  YT Music ↗
                </a>
                <a
                  href={`https://youtu.be/${activeTrack.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  YouTube ↗
                </a>
              </div>
            </div>
          </div>

          {/* Seekbar Section */}
          <div className="flex items-center gap-3 w-full select-none mt-2">
            <span className="text-[10px] text-white/40 font-mono w-8 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
            </div>
            <span className="text-[10px] text-white/40 font-mono w-8 text-left shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Bar Section */}
          <div className="flex items-center justify-between w-full mt-1 border-t border-white/5 pt-3">
            {/* Left controls: Playlist toggle, Shuffle, Repeat */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPlaylistOpen(true)}
                className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                title="Playlist"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                </svg>
              </button>

              <button
                onClick={() => setIsShuffle(!isShuffle)}
                className={`p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                  isShuffle ? "text-amber-400" : "text-white/45"
                }`}
                title="Shuffle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M4.5 12a48.563 48.563 0 00-.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3" />
                </svg>
              </button>

              <button
                onClick={() => setPlayOnce(!playOnce)}
                className={`p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                  playOnce ? "text-amber-400" : "text-white/45"
                }`}
                title="Play Once"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  {playOnce ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662M5.25 5.25h13.5M5.25 18.75h13.5" />
                  )}
                </svg>
              </button>
            </div>

            {/* Center controls: Prev, Play/Pause, Next */}
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrev}
                className="p-2 text-white/70 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Previous"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-white hover:bg-amber-50 text-black rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-black translate-x-[1.5px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              <button
                onClick={handleNext}
                className="p-2 text-white/70 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Next"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/>
                </svg>
              </button>
            </div>

            {/* Right side spacer to balance the layout */}
            <div className="w-24 hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Playlist Modal */}
      {isPlaylistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#16110e]/95 p-6 shadow-2xl flex flex-col max-h-[80vh] text-left">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h2 className="text-lg font-bold text-white font-serif">ಕನ್ನಡ ಕಸ್ತೂರಿ ಪ್ಲೇಲಿಸ್ಟ್</h2>
                <p className="text-xs text-white/50">{tracks.length} Curated Retro Tracks</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaylistOpen(false)}
                  className="p-2 text-white/50 hover:text-white rounded-full bg-white/5 border border-white/10 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1 scrollbar-thin">
              {tracks.map((trackItem, index) => {
                const isActive = index === currentTrackIndex;
                return (
                  <div
                    key={trackItem.id}
                    onClick={() => {
                      setCurrentTrackIndex(index);
                      setIsPlaying(true);
                      setIsPlaylistOpen(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                      isActive
                        ? "bg-amber-950/20 border border-amber-500/40"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Left: YouTube Video Thumbnail loaded directly from YT CDN */}
                      <div className="w-20 aspect-video rounded-lg bg-black border border-white/10 relative shrink-0 overflow-hidden">
                        <img
                          src={`https://img.youtube.com/vi/${trackItem.videoId}/mqdefault.jpg`}
                          alt={trackItem.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isActive && isPlaying && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-amber-400 text-xs font-bold animate-pulse">▶</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-amber-300" : "text-white"}`}>
                          {index + 1}. {trackItem.title}
                        </p>
                        <p className="text-xs text-white/50 truncate font-serif">
                          {trackItem.artist} • {trackItem.film}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-white/40 font-mono">{trackItem.year}</span>
                      <a
                        href={`https://youtu.be/${trackItem.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-white/40 hover:text-white p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
              <span>YouTube Audio Integration • HD Sound</span>
              <span className="text-amber-400 font-semibold">{tracks.length} Tracks</span>
            </div>
          </div>
        </div>
      )}

      {/* Hidden YouTube Player Target for Audio Playback */}
      <div className="fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none overflow-hidden">
        <div id={containerId} />
      </div>
    </>
  );
};
