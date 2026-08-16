"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const CROSSFADE_DURATION = 1.5; // Crossfade duration in seconds

interface BackgroundVideoProps {
  src?: string;
  portraitImage?: string;
  className?: string;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  src = "/bg/bg-video.mp4",
  portraitImage = "/bg/Portrait-mobile.png",
  className = "",
}) => {
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);

  // 'A' or 'B' is currently the primary visible video
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [isFading, setIsFading] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

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

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    isFadingRef.current = isFading;
  }, [isFading]);

  // Handle switching to the next video layer
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

    // After transition duration completes, pause the previous video and reset its position
    setTimeout(() => {
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.currentTime = 0;
      }
      isFadingRef.current = false;
      setIsFading(false);
    }, CROSSFADE_DURATION * 1000);
  }, []);

  // Monitor playback progress for initiating crossfade before end
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

  // Initial playback start for landscape mode
  useEffect(() => {
    if (isPortrait) {
      if (videoRefA.current) videoRefA.current.pause();
      if (videoRefB.current) videoRefB.current.pause();
      return;
    }

    const videoA = videoRefA.current;
    if (videoA) {
      videoA.currentTime = 0;
      const playPromise = videoA.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setHasStarted(true);
          })
          .catch((err) => {
            console.warn("Initial autoplay prevented:", err);
            // Retry on user interaction anywhere on the window
            const handleUserInteraction = () => {
              videoA.play().then(() => setHasStarted(true)).catch(() => {});
              window.removeEventListener("click", handleUserInteraction);
              window.removeEventListener("touchstart", handleUserInteraction);
              window.removeEventListener("keydown", handleUserInteraction);
            };
            window.addEventListener("click", handleUserInteraction, { once: true });
            window.addEventListener("touchstart", handleUserInteraction, { once: true });
            window.addEventListener("keydown", handleUserInteraction, { once: true });
          });
      }
    }
  }, [isPortrait]);

  return (
    <div
      className={`fixed inset-0 -z-20 w-full h-full overflow-hidden bg-black ${className}`}
      aria-hidden="true"
    >
      {/* 1. Portrait Background Image (shown on portrait resolutions / mobile portrait) */}
      <div
        className="portrait:block landscape:hidden absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{ backgroundImage: `url(${portraitImage})` }}
      />

      {/* 2. Landscape Video Background Layers (shown on landscape / desktop resolutions) */}
      <div className="portrait:hidden landscape:block absolute inset-0 w-full h-full">
        {/* Video Layer A */}
        <video
          ref={videoRefA}
          src={src}
          playsInline
          autoPlay
          muted
          preload="auto"
          onTimeUpdate={() => handleTimeUpdate("A")}
          onEnded={() => handleEnded("A")}
          onPlaying={() => setHasStarted(true)}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-1500 ease-in-out will-change-[opacity]"
          style={{
            opacity: activeLayer === "A" ? 1 : 0,
            zIndex: activeLayer === "A" ? 2 : 1,
          }}
        />

        {/* Video Layer B */}
        <video
          ref={videoRefB}
          src={src}
          playsInline
          muted
          preload="auto"
          onTimeUpdate={() => handleTimeUpdate("B")}
          onEnded={() => handleEnded("B")}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none transition-opacity duration-1500 ease-in-out will-change-[opacity]"
          style={{
            opacity: activeLayer === "B" ? 1 : 0,
            zIndex: activeLayer === "B" ? 2 : 1,
          }}
        />
      </div>
    </div>
  );
};
