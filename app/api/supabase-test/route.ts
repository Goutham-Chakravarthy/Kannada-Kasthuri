import { NextResponse } from "next/server";
import { getPlaylists } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return NextResponse.json({
            connected: false,
            error: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in environment variables.",
        }, { status: 400 });
    }

    try {
        const supabase = createClient(url, key);
        const { data: dbData, error: dbError } = await supabase
            .from("playlists")
            .select("id, name, tracks, created_at")
            .limit(10);

        if (dbError) {
            return NextResponse.json({
                connected: false,
                error: dbError.message,
                hint: "Run the SQL script in 'supabase/schema.sql' inside your Supabase SQL editor to create the playlists table and policies.",
                details: dbError,
            }, { status: 500 });
        }

        const playlists = await getPlaylists();
        const totalTracks = playlists.reduce((acc, p) => acc + (p.tracks?.length || 0), 0);

        return NextResponse.json({
            connected: true,
            supabaseUrl: url,
            tableExists: true,
            supabasePlaylistsCount: dbData?.length || 0,
            activePlaylists: playlists.map((p) => ({
                id: p.id,
                name: p.name,
                trackCount: p.tracks?.length || 0,
            })),
            totalTracksAcrossAllPlaylists: totalTracks,
        });
    } catch (err: any) {
        return NextResponse.json({
            connected: false,
            error: err?.message || String(err),
        }, { status: 500 });
    }
}