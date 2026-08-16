import React from "react";
import Image from "next/image";
import { Player } from "@/components/Player";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { getShuffledTracks } from "@/app/tracks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  const initialTracks = getShuffledTracks();

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-between overflow-hidden">
      {/* 1. Background Video with smooth infinite crossfade (landscape) and portrait mobile background */}
      <BackgroundVideo src="/bg/bg-video.mp4" portraitImage="/bg/Portrait-mobile.png" />

      {/* 2. Center Hero Screen Graphic */}
      <div className="flex-1 w-full flex items-center justify-center z-10 px-4 pt-16 sm:pt-14 pb-2 select-none pointer-events-none">
        <div className="relative flex items-center justify-center group pointer-events-auto">
          <Image
            src="/bg/Hero.png"
            alt="ಕನ್ನಡ ಕಸ್ತೂರಿ"
            width={947}
            height={706}
            priority
            className="w-[320px] xs:w-[360px] sm:w-[460px] md:w-[560px] lg:w-[680px] xl:w-[760px] h-auto max-h-[50vh] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.75)] transition-transform duration-500 ease-out hover:scale-105 cursor-pointer select-none"
          />
        </div>
      </div>

      {/* 3. The player (including the top row) */}
      <Player initialTracks={initialTracks} />
    </main>
  );
}
