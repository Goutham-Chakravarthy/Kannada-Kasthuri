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

async function run() {
  const { data, error } = await supabase.from('playlists').select('*');
  if (error) {
    console.error("Error fetching playlists:", error);
    return;
  }
  for (const pl of data) {
    console.log(`Playlist: ${pl.name} (ID: ${pl.id})`);
    console.log(`Tracks count: ${pl.tracks ? pl.tracks.length : 0}`);
    if (pl.tracks) {
      pl.tracks.forEach(t => {
        console.log(`  - ${t.title} (Duration: ${t.duration}, VideoId: ${t.videoId})`);
      });
    }
  }
}

run();
