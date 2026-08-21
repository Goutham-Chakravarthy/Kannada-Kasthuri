const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Env Variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getYoutubeDuration(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    
    // Look for approxDurationMs
    const match = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
    if (match && match[1]) {
      const ms = parseInt(match[1], 10);
      const totalSeconds = Math.round(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    // Fallback: look for <meta itemprop="duration" content="PT4M15S">
    const metaMatch = html.match(/<meta itemprop="duration" content="PT(\d+M\d+S|\d+S|\d+M|\d+H\d+M\d+S)">/);
    if (metaMatch && metaMatch[1]) {
      const dur = metaMatch[1];
      let minutes = 0;
      let seconds = 0;
      const mMatch = dur.match(/(\d+)M/);
      const sMatch = dur.match(/(\d+)S/);
      if (mMatch) minutes = parseInt(mMatch[1], 10);
      if (sMatch) seconds = parseInt(sMatch[1], 10);
      if (!mMatch && sMatch) {
        const total = parseInt(sMatch[1], 10);
        minutes = Math.floor(total / 60);
        seconds = total % 60;
      }
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  } catch (e) {
    console.error(`Error fetching duration for ${videoId}:`, e);
  }
  return null;
}

async function run() {
  const playlistId = 'bhavageete-2';
  const { data: playlist, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .single();

  if (error || !playlist) {
    console.error("Error fetching playlist:", error);
    return;
  }

  console.log(`Updating playlist ${playlist.name}...`);
  const updatedTracks = [];

  for (const track of playlist.tracks) {
    console.log(`Fetching duration for: ${track.title} (ID: ${track.videoId})`);
    const duration = await getYoutubeDuration(track.videoId);
    if (duration) {
      console.log(`  -> Found duration: ${duration}`);
      updatedTracks.push({
        ...track,
        duration: duration
      });
    } else {
      console.log(`  -> Keep default: ${track.duration}`);
      updatedTracks.push(track);
    }
    // Add small delay to be gentle to YT
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  const { error: updateError } = await supabase
    .from('playlists')
    .update({ tracks: updatedTracks, updated_at: new Date().toISOString() })
    .eq('id', playlistId);

  if (updateError) {
    console.error("Error updating playlist tracks:", updateError);
  } else {
    console.log("Successfully updated Bhavageete playlist durations!");
  }
}

run();
