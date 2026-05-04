import "../globals.css";
// import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";

const headingFont = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const accentFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ResistanceRadar Web",
  description: "Doctor and medical shop dashboard for AMR surveillance",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} ${accentFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
