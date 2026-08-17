import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { verifyAdminRequest } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "bg", "uploads");

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
]);

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

    // Extract extension
    const originalName = file.name || "background";
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type .${ext}. Allowed formats: MP4, WebM, PNG, JPG, WebP, GIF.`,
        },
        { status: 400 }
      );
    }

    // Generate clean filename
    const safeTarget = target.replace(/[^a-z0-9_-]/gi, "");
    const filename = `bg-${safeTarget}-${Date.now()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try uploading to Supabase Storage if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Attempt to create bucket if it doesn't exist
        try {
          await supabase.storage.createBucket("backgrounds", {
            public: true,
          });
        } catch {
          // ignore
        }

        const { data, error } = await supabase.storage
          .from("backgrounds")
          .upload(filename, buffer, {
            contentType: file.type || (isVideo ? `video/${ext}` : `image/${ext}`),
            cacheControl: "3600",
            upsert: true,
          });

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from("backgrounds")
            .getPublicUrl(filename);

          return NextResponse.json({
            success: true,
            url: publicUrl,
            filename,
            type: isVideo ? "video" : "image",
          });
        } else {
          console.warn("Supabase Storage upload failed, falling back to local:", error);
        }
      } catch (err) {
        console.warn("Supabase Storage upload exception, falling back to local:", err);
      }
    }

    // Local Disk Fallback (will fail in serverless production like Vercel but works locally)
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
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
      return NextResponse.json({
        error: "Failed to upload background file. Supabase is not connected and local filesystem is read-only.",
        details: localWriteError?.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Background upload error:", error);
    return NextResponse.json({ error: "Failed to upload background file" }, { status: 500 });
  }
}
