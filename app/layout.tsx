import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { NewPageEntry } from "@/components/new-page-entry";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const instant = false;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Twigigi",
    template: "%s · Twigigi",
  },
  description:
    "A shareable Twig for people and small local businesses. Create it in minutes, post it anywhere, and take orders, quotes, or messages.",
  applicationName: "Twigigi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        <NewPageEntry>{children}</NewPageEntry>
      </body>
    </html>
  );
}
