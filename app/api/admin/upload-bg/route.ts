import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { verifyAdminRequest } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOAD_DIR = path.join(process.cwd(), "public", "bg", "uploads");

// Allowed video & image file extensions
const ALLOWED_EXTENSIONS = new Set([
  // Video formats
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
  "mkv",
  // Image formats
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
]);

function getMimeType(ext: string, browserType?: string): string {
  if (browserType && browserType !== "application/octet-stream" && browserType.length > 3) {
    return browserType;
  }
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    mkv: "video/x-matroska",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    svg: "image/svg+xml",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const target = (formData.get("target") as string) || "media"; // "landscape" or "portrait"

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check file size (limit: 50MB)
    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit. Please compress the video or image before uploading." },
        { status: 400 }
      );
    }

    // Extract extension
    const originalName = file.name || "background";
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type .${ext}. Allowed formats: MP4, WebM, MOV, PNG, JPG, WebP, GIF, AVIF.`,
        },
        { status: 400 }
      );
    }

    // Generate clean filename
    const safeTarget = target.replace(/[^a-z0-9_-]/gi, "");
    const filename = `bg-${safeTarget}-${Date.now()}.${ext}`;
    const isVideo = ["mp4", "webm", "ogg", "mov", "m4v", "mkv"].includes(ext);
    const mimeType = getMimeType(ext, file.type);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Try uploading to Supabase Storage if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Attempt to create bucket if it doesn't exist
        try {
          await supabase.storage.createBucket("backgrounds", {
            public: true,
          });
        } catch {
          // ignore bucket already exists
        }

        const { data, error } = await supabase.storage
          .from("backgrounds")
          .upload(filename, buffer, {
            contentType: mimeType,
            cacheControl: "31536000",
            upsert: true,
          });

        if (!error && data) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("backgrounds").getPublicUrl(filename);

          return NextResponse.json({
            success: true,
            url: publicUrl,
            filename,
            type: isVideo ? "video" : "image",
          });
        } else if (error) {
          console.warn("Supabase Storage upload returned error, trying local fallback:", error);
        }
      } catch (err) {
        console.warn("Supabase Storage upload exception, trying local fallback:", err);
      }
    }

    // 2. Local Disk Fallback (works in local development and persistent servers)
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(filePath, buffer);

      const publicUrl = `/bg/uploads/${filename}`;

      return NextResponse.json({
        success: true,
        url: publicUrl,
        filename,
        type: isVideo ? "video" : "image",
      });
    } catch (localWriteError: any) {
      console.error("Local filesystem write failed:", localWriteError);
      return NextResponse.json(
        {
          error:
            "Failed to save uploaded file. Ensure Supabase Storage is configured or run the storage schema in Supabase SQL editor.",
          details: localWriteError?.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Background upload error:", error);
    return NextResponse.json({ error: "Failed to upload media file" }, { status: 500 });
  }
}
