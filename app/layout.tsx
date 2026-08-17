import type { Metadata, Viewport } from "next";
import { Noto_Serif_Kannada } from "next/font/google";
import "./globals.css";

const kannadaFont = Noto_Serif_Kannada({
  variable: "--font-kannada",
  subsets: ["kannada", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Kannada Kasturi | ಕನ್ನಡ ಕಸ್ತೂರಿ",
  description: "A nostalgic retro radio player for classic Kannada songs.",
  icons: {
    icon: [
      { url: "/bg/icon.png" },
      { url: "/bg/icon.png", type: "image/png" }
    ],
    shortcut: "/bg/icon.png",
    apple: "/bg/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${kannadaFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-black text-white">
        {children}
      </body>
    </html>
  );
}
