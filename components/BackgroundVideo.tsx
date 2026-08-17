"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const CROSSFADE_DURATION = 1.5; // Video loop crossfade in seconds

export function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".ogg") ||
    clean.endsWith(".mov") ||
    clean.includes("/video") ||
    clean.includes(".mp4?")
  );
}

interface BackgroundVideoProps {
  src?: string; // Landscape source (video or image)
  portraitImage?: string; // Portrait source (video or image)
  className?: string;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  src = "/bg/bg-video.mp4",
  portraitImage = "/bg/Portrait-mobile.png",
  className = "",
}) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  // Video refs for landscape looping
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const portraitVideoRef = useRef<HTMLVideoElement | null>(null);

  // 'A' or 'B' is currently the primary visible video
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [isFading, setIsFading] = useState<boolean>(false);

  // Smooth media transition state when changing playlists
  const [currentLandscapeSrc, setCurrentLandscapeSrc] = useState(src);
  const [currentPortraitSrc, setCurrentPortraitSrc] = useState(portraitImage);

  const activeLayerRef = useRef<"A" | "B">("A");
  const isFadingRef = useRef<boolean>(false);

  // Detect orientation dynamically
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortrait(portrait);
    };

    checkOrientation();
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    mediaQuery.addEventListener("change", checkOrientation);
    window.addEventListener("resize", checkOrientation);

    return () => {
      mediaQuery.removeEventListener("change", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, []);

  // Update background sources when props change with smooth transition
  useEffect(() => {
    setCurrentLandscapeSrc(src || "/bg/bg-video.mp4");
  }, [src]);

  useEffect(() => {
    setCurrentPortraitSrc(portraitImage || "/bg/Portrait-mobile.png");
  }, [portraitImage]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    isFadingRef.current = isFading;
  }, [isFading]);

  // Handle switching to next video layer in landscape video loop
  const startCrossfade = useCallback(() => {
    if (isFadingRef.current) return;
    isFadingRef.current = true;
    setIsFading(true);

    const currentLayer = activeLayerRef.current;
    const nextLayer = currentLayer === "A" ? "B" : "A";
    const nextVideo = nextLayer === "A" ? videoRefA.current : videoRefB.current;
    const currentVideo = currentLayer === "A" ? videoRefA.current : videoRefB.current;

    if (nextVideo) {
      nextVideo.currentTime = 0;
      const playPromise = nextVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Background video autoplay warning:", err);
        });
      }
    }

    setActiveLayer(nextLayer);

    setTimeout(() => {
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.currentTime = 0;
      }
      isFadingRef.current = false;
      setIsFading(false);
    }, CROSSFADE_DURATION * 1000);
  }, []);

  const handleTimeUpdate = useCallback(
    (layer: "A" | "B") => {
      if (layer !== activeLayerRef.current || isFadingRef.current) return;

      const video = layer === "A" ? videoRefA.current : videoRefB.current;
      if (!video || !video.duration || isNaN(video.duration)) return;

      const timeRemaining = video.duration - video.currentTime;
      if (timeRemaining <= CROSSFADE_DURATION) {
        startCrossfade();
      }
    },
    [startCrossfade]
  );

  const handleEnded = useCallback(
    (layer: "A" | "B") => {
      if (layer === activeLayerRef.current) {
        startCrossfade();
      }
    },
    [startCrossfade]
  );

  // Playback initialization when switching sources or orientation
  useEffect(() => {
    const isLandscapeVideo = isVideoUrl(currentLandscapeSrc);
    if (!isPortrait && isLandscapeVideo) {
      const videoA = videoRefA.current;
      if (videoA) {
        videoA.currentTime = 0;
        const playPromise = videoA.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const unlock = () => {
              videoA.play().catch(() => {});
              window.removeEventListener("click", unlock);
              window.removeEventListener("touchstart", unlock);
            };
            window.addEventListener("click", unlock, { once: true });
            window.addEventListener("touchstart", unlock, { once: true });
          });
        }
      }
    }
  }, [isPortrait, currentLandscapeSrc]);

  // Portrait video autoplay
  useEffect(() => {
    const isPortraitVideo = isVideoUrl(currentPortraitSrc);
    if (isPortrait && isPortraitVideo && portraitVideoRef.current) {
      portraitVideoRef.current.play().catch(() => {});
    }
  }, [isPortrait, currentPortraitSrc]);

  const isLandscapeVideo = isVideoUrl(currentLandscapeSrc);
  const isPortraitVideo = isVideoUrl(currentPortraitSrc);

  return (
    <div
      className={`fixed inset-0 -z-20 w-full h-full overflow-hidden bg-[#0a090b] ${className}`}
      aria-hidden="true"
    >
      {/* Smooth Entrance Flow Container */}
      <div className="absolute inset-0 w-full h-full animate-bg-flow-down">
        {/* 1. Portrait Background (Shown on mobile portrait resolutions) */}
        <div className="portrait:block landscape:hidden absolute inset-0 w-full h-full">
          {isPortraitVideo ? (
            <video
              ref={portraitVideoRef}
              src={currentPortraitSrc}
              playsInline
              autoPlay
              loop
              muted
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ease-in-out"
            />
          ) : (
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out scale-100"
              style={{ backgroundImage: `url(${currentPortraitSrc})` }}
            />
          )}
        </div>

        {/* 2. Landscape Background (Shown on desktop/landscape resolutions) */}
        <div className="portrait:hidden landscape:block absolute inset-0 w-full h-full">
          {isLandscapeVideo ? (
            <>
              {/* Video Layer A */}
              <video
                ref={videoRefA}
                src={currentLandscapeSrc}
                playsInline
                autoPlay
                muted
                preload="auto"
                onTimeUpdate={() => handleTimeUpdate("A")}
                onEnded={() => handleEnded("A")}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-1000 ease-in-out will-change-[opacity]"
                style={{
                  opacity: activeLayer === "A" ? 1 : 0,
                  zIndex: activeLayer === "A" ? 2 : 1,
                }}
              />

              {/* Video Layer B */}
              <video
                ref={videoRefB}
                src={currentLandscapeSrc}
                playsInline
                muted
                preload="auto"
                onTimeUpdate={() => handleTimeUpdate("B")}
                onEnded={() => handleEnded("B")}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-1000 ease-in-out will-change-[opacity]"
                style={{
                  opacity: activeLayer === "B" ? 1 : 0,
                  zIndex: activeLayer === "B" ? 2 : 1,
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
              style={{ backgroundImage: `url(${currentLandscapeSrc})` }}
            />
          )}
        </div>
      </div>

      {/* Smooth Curtain Sweep Overlay (Sweeps from top to down on entry) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a090b] via-[#0a090b]/80 to-transparent pointer-events-none animate-curtain-flow" />

      {/* Subtle global dark overlay for high readability */}
      <div className="absolute inset-0 bg-black/35 pointer-events-none" />
    </div>
  );
};
