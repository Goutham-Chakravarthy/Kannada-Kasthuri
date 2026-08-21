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
      const dur = metaMatch[1]; // e.g. 4M15S or 255S or 4M
      let minutes = 0;
      let seconds = 0;
      const mMatch = dur.match(/(\d+)M/);
      const sMatch = dur.match(/(\d+)S/);
      if (mMatch) minutes = parseInt(mMatch[1], 10);
      if (sMatch) seconds = parseInt(sMatch[1], 10);
      if (!mMatch && sMatch) {
        // just seconds
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

async function test() {
  const dur = await getYoutubeDuration('sSlvz01R43Y');
  console.log('Duration for sSlvz01R43Y:', dur);
}

test();
