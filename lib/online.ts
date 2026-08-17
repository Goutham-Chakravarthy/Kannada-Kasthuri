import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    return null;
  }
}

// In-memory fallback tracker
const inMemorySessions: Map<string, number> = new Map();

// Record a heartbeat ping from a specific sessionId and return active count
export async function pingSession(sessionId: string): Promise<number> {
  const now = Date.now();
  const cutoffTime = new Date(now - 30000).toISOString(); // Active in last 30 seconds

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Upsert current session's last_seen
      await supabase
        .from("active_sessions")
        .upsert(
          {
            session_id: sessionId,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );

      // Periodically clean up stale sessions older than 60s
      const staleCutoff = new Date(now - 60000).toISOString();
      await supabase.from("active_sessions").delete().lt("last_seen", staleCutoff);

      // Count active sessions seen in the last 30s
      const { count, error } = await supabase
        .from("active_sessions")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", cutoffTime);

      if (!error && typeof count === "number") {
        return Math.max(1, count);
      }
    } catch (e) {
      console.warn("Supabase active_sessions error, using in-memory:", e);
    }
  }

  // Fallback in-memory tracking
  inMemorySessions.set(sessionId, now);
  for (const [id, lastSeen] of inMemorySessions.entries()) {
    if (now - lastSeen > 30000) {
      inMemorySessions.delete(id);
    }
  }

  return Math.max(1, inMemorySessions.size);
}

// Get the current accurate online count
export async function getAccurateOnlineCount(): Promise<number> {
  const now = Date.now();
  const cutoffTime = new Date(now - 30000).toISOString();

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("active_sessions")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", cutoffTime);

      if (!error && typeof count === "number") {
        return Math.max(1, count);
      }
    } catch (e) {
      console.warn("Supabase getAccurateOnlineCount error:", e);
    }
  }

  // Fallback in-memory
  for (const [id, lastSeen] of inMemorySessions.entries()) {
    if (now - lastSeen > 30000) {
      inMemorySessions.delete(id);
    }
  }
  return Math.max(1, inMemorySessions.size);
}

// Remove session when leaving tab / browser
export async function removeSession(sessionId: string): Promise<void> {
  inMemorySessions.delete(sessionId);
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from("active_sessions").delete().eq("session_id", sessionId);
    } catch {}
  }
}
