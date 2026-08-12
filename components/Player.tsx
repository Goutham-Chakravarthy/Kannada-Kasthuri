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

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now);
      setTimeStr(formatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  const parts = timeStr.split(":");
  if (parts.length === 2) {
    const hour = parts[0];
    const minuteAndAmPm = parts[1]; // e.g. "05 pm"
    return (
      <span className="tabular-nums font-medium tracking-wide">
        {hour}
        <span className="animate-blink inline-block mx-[1px]">:</span>
        {minuteAndAmPm}
      </span>
    );
  }

  return <span className="tabular-nums">{timeStr}</span>;
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
      <header className="fixed top-0 inset-x-0 flex items-center justify-between select-none z-30 px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))]">
        {/* Clock top-left */}
        <div className="flex flex-col text-white/90 text-sm font-semibold drop-shadow-md">
          <Clock />
          <span className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">IST</span>
        </div>

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
        <div className="flex items-center gap-4 text-xs font-semibold drop-shadow-md text-white/70">
          ದರ್ಶಿನಿ ರೇಡಿಯೋ
        </div>
      </header>

      {/* Kannada Landing Page Overlay */}
      {!hasInteracted && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-black/55 backdrop-blur-sm transition-all duration-500">
          {/* Logo Badge / Spinning Vinyl Style */}
          <div className="w-24 h-24 rounded-full bg-black/60 border border-white/10 flex items-center justify-center shadow-2xl mb-8 relative group cursor-pointer animate-spin-vinyl">
            <span className="text-4xl select-none">📻</span>
            <div className="absolute inset-0 rounded-full border border-orange-500/30 animate-ping" style={{ animationDuration: '3s' }} />
          </div>

          {/* Kannada Title */}
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-wide text-orange-50 font-serif mb-2 drop-shadow-lg">
            ದರ್ಶಿನಿ ರೇಡಿಯೋ
          </h1>
          <p className="text-xs font-semibold tracking-widest text-orange-300/80 font-mono uppercase mb-8 select-none">
            Darshini Radio
          </p>

          {/* Subtext / Description */}
          <p className="text-sm sm:text-base text-white/80 max-w-md leading-relaxed mb-10 px-4">
            ನಮಸ್ಕಾರ — ದರ್ಶಿನಿ ರೇಡಿಯೋಗೆ ಸುಸ್ವಾಗತ. <br />
            <span className="text-white/60 text-xs sm:text-sm mt-2 block">
              ಚಹಾದ ಸವಿಯೊಂದಿಗೆ ಹಳೆಯ ಮಧುರ ಕನ್ನಡ ಗೀತೆಗಳ ಸವಾರಿ.
            </span>
          </p>

          {/* Play / Enter Button */}
          <button
            onClick={() => {
              setHasInteracted(true);
              togglePlay();
            }}
            className="flex items-center gap-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full p-2 pr-6 cursor-pointer transform active:scale-95 transition-all shadow-xl hover:shadow-orange-500/10 group"
          >
            <div className="w-12 h-12 bg-gradient-to-b from-orange-500 to-orange-700 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(255,94,58,0.4)] group-hover:from-orange-400 group-hover:to-orange-600 transition-colors">
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
            ಪ್ಲೇ ಒತ್ತಿದ ನಂತರ ಆಡಿಯೋ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ. ಸ್ಪೇಸ್ ಬಾರ್ ಬಳಸಿ ಪ್ಲೇ/ಪಾಸ್ ಮಾಡಬಹುದು.
          </p>
        </div>
      )}

      {/* Main player box wrapper */}
      <div className="relative w-full max-w-xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] z-20">
        
        {/* Dynamic Shared Absolute YouTube Player container that perfectly overlaps the vinyl slots */}
        <div
          className={`absolute rounded-full overflow-hidden border border-white/20 transition-all duration-300 animate-spin-vinyl z-10 ${
            isPlaying ? "running" : "paused"
          } left-[32px] top-[32px] w-[64px] h-[64px]`}
          style={{ animationPlayState: isPlaying ? "running" : "paused" }}
        >
          {/* Spindle hole */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-3 h-3 bg-black/80 rounded-full ring-2 ring-white/40 shadow-sm" />
          </div>
          {/* YouTube Video Target */}
          <div id={containerId} className="w-full h-full object-cover scale-150 pointer-events-none" />
        </div>

        {/* DESKTOP UI: horizontal glass pill */}
        <div className="hidden sm:flex flex-col gap-3 rounded-full p-4 pl-6 glass-panel relative w-full h-[128px] justify-center">
          {/* Row 1: Vinyl + Info (Left) and Transport Controls (Right) */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 min-w-0 pl-16">
              <div className="flex flex-col min-w-0">
                <span className="text-[16px] font-bold truncate text-white leading-tight">
                  {activeTrack.title}
                </span>
                <span className="text-[12.5px] text-white/60 truncate mt-0.5">
                  {activeTrack.artist} • <span className="text-white/45 font-mono text-[11px]">{activeTrack.film}</span>
                </span>
              </div>
            </div>

            {/* Transport & Auxiliary Controls */}
            <div className="flex items-center gap-3 select-none pr-2">
              {/* Shuffle / Line toggle */}
              <button
                onClick={() => setIsShuffle(!isShuffle)}
                className={`p-1.5 cursor-pointer transition-colors ${
                  isShuffle ? "text-orange-400 hover:text-orange-300" : "text-white/45 hover:text-white"
                }`}
                title={isShuffle ? "Shuffle Mode (Active)" : "Sequential / Line Mode"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M4.5 12a48.563 48.563 0 00-.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3" />
                </svg>
              </button>

              {/* Play Once toggle */}
              <button
                onClick={() => setPlayOnce(!playOnce)}
                className={`p-1.5 cursor-pointer transition-colors ${
                  playOnce ? "text-orange-400 hover:text-orange-300" : "text-white/45 hover:text-white"
                }`}
                title={playOnce ? "Play Once Mode (Active)" : "Continuous Loop Mode"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  {playOnce ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662M5.25 5.25h13.5M5.25 18.75h13.5" />
                  )}
                </svg>
              </button>

              {/* Prev Button */}
              <button
                onClick={handlePrev}
                className="p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Previous"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
                </svg>
              </button>

              {/* Solid White Play/Pause Button */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black cursor-pointer shadow-lg active:scale-95 transition-transform"
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

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Next"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/>
                </svg>
              </button>

              {/* Playlist Button */}
              <button
                onClick={() => setIsPlaylistOpen(true)}
                className="p-1.5 text-white/45 hover:text-white transition-colors cursor-pointer"
                title="Playlist"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: Seek bar */}
          <div className="flex items-center gap-3 w-full select-none mt-1">
            <span className="text-[11px] text-white/45 font-mono w-10 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
            </div>
            <span className="text-[11px] text-white/45 font-mono w-10 text-left shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* MOBILE UI: stacked card */}
        <div className="sm:hidden flex flex-col gap-4 rounded-[26px] p-4 glass-panel relative w-full pt-16">
          <div className="flex items-center justify-between w-full pl-16">
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold truncate text-white leading-tight">
                {activeTrack.title}
              </span>
              <span className="text-xs text-white/60 truncate mt-0.5">
                {activeTrack.artist}
              </span>
            </div>
          </div>

          {/* Seek bar */}
          <div className="flex items-center gap-3 w-full select-none mt-1">
            <span className="text-[10.5px] text-white/45 font-mono w-10 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
            </div>
            <span className="text-[10.5px] text-white/45 font-mono w-10 text-left shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Row 3: Transport & auxiliary buttons */}
          <div className="flex items-center justify-between min-h-[48px] px-2 select-none">
            {/* Playlist Button */}
            <button
              onClick={() => setIsPlaylistOpen(true)}
              className="p-3 text-white/45 hover:text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Playlist"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
            </button>

            {/* Shuffle Button */}
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-3 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isShuffle ? "text-orange-400" : "text-white/45"
              }`}
              title="Shuffle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M4.5 12a48.563 48.563 0 00-.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3" />
              </svg>
            </button>

            {/* Play Once Button */}
            <button
              onClick={() => setPlayOnce(!playOnce)}
              className={`p-3 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center ${
                playOnce ? "text-orange-400" : "text-white/45"
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

            {/* Prev Button */}
            <button
              onClick={handlePrev}
              className="p-3 text-white/70 hover:text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
              </svg>
            </button>

            {/* Play Button */}
            <button
              onClick={togglePlay}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-black cursor-pointer shadow-lg active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-black translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Next Button */}
            <button
              onClick={handleNext}
              className="p-3 text-white/70 hover:text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/>
              </svg>
            </button>
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
                <h2 className="text-lg font-bold text-white">ದರ್ಶಿನಿ ಕನ್ನಡ ಪ್ಲೇಲಿಸ್ಟ್</h2>
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
                      {/* Left: YouTube Video Thumbnail (16:9 aspect-video) loaded directly from YT CDN */}
                      <div className="w-20 aspect-video rounded-lg bg-black border border-white/10 relative shrink-0 overflow-hidden">
                        <img
                          src={`https://img.youtube.com/vi/${trackItem.videoId}/mqdefault.jpg`}
                          alt={trackItem.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isActive && isPlaying && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-orange-400 text-xs font-bold animate-pulse">▶</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-orange-300" : "text-white"}`}>
                          {index + 1}. {trackItem.title}
                        </p>
                        <p className="text-xs text-white/50 truncate">
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
              <span className="text-orange-400 font-semibold">{tracks.length} Tracks</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
