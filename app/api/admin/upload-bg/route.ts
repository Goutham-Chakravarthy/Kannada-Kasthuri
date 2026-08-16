import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { verifyAdminRequest } from "@/lib/auth";

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

    // Ensure uploads directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Generate clean filename
    const safeTarget = target.replace(/[^a-z0-9_-]/gi, "");
    const filename = `bg-${safeTarget}-${Date.now()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/bg/uploads/${filename}`;
    const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      type: isVideo ? "video" : "image",
    });
  } catch (error) {
    console.error("Background upload error:", error);
    return NextResponse.json({ error: "Failed to upload background file" }, { status: 500 });
  }
}
