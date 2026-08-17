import React from "react";
import Image from "next/image";
import { Player } from "@/components/Player";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { getPlaylists } from "@/lib/db";
import { shuffleTrackList } from "@/app/tracks";
import { getAccurateOnlineCount } from "@/lib/online";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initialPlaylists = await getPlaylists();
  const shuffledPlaylists = initialPlaylists.map((pl) => ({
    ...pl,
    tracks: shuffleTrackList(pl.tracks),
  }));
  const initialTracks = shuffledPlaylists[0]?.tracks || [];
  const initialOnlineCount = await getAccurateOnlineCount();

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-between overflow-hidden">
      {/* 1. Center Hero Screen Graphic */}
      <div className="flex-1 w-full flex items-center justify-center z-10 px-4 pt-16 sm:pt-14 pb-2 select-none pointer-events-none">
        <div className="relative flex items-center justify-center group/hero pointer-events-none">
          <Image
            src="/bg/Hero.png"
            alt="ಕನ್ನಡ ಕಸ್ತೂರಿ"
            width={947}
            height={706}
            priority
            className="w-[320px] xs:w-[360px] sm:w-[460px] md:w-[560px] lg:w-[680px] xl:w-[760px] h-auto max-h-[50vh] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.75)] transition-transform duration-500 ease-out group-hover/hero:scale-105 select-none"
          />
          {/* Reduced hover hit radius focused strictly around center */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45%] h-[48%] rounded-full pointer-events-auto cursor-pointer"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* 3. The player (including the top row) */}
      <Player
        initialTracks={initialTracks}
        initialPlaylists={shuffledPlaylists}
        initialOnlineCount={initialOnlineCount}
      />
    </main>
  );
}
