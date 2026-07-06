import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderProfile from "@/components/HeaderProfile";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Powabase Chat",
  description: "ChatGPT-like interface powered by Powabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#1a1a1a]">
        <header className="w-full flex items-center px-6 py-4 bg-[#111] border-b border-white/5">
          <a href="/" className="flex items-center gap-2.5 mr-auto hover:opacity-80 transition-opacity">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-yellow-400"
            >
              <path d="M13 2 4.5 13.5H11L10 22l9.5-12H14L13 2Z" />
            </svg>
            <span className="text-white font-semibold text-base tracking-wide" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
              Powabase Chat
            </span>
          </a>
          <HeaderProfile />
        </header>
        {children}
      </body>
    </html>
  );
}
