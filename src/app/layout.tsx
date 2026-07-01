import type { Metadata } from "next";
import "./globals.css";
import { UIProvider } from "../context/UIContext";

export const metadata: Metadata = {
  title: "ResearchPortal | Human-Centric Telemetry",
  description: "Exploring the intersection of human behavior and digital interaction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#020617]">
        <UIProvider>
          {children}
        </UIProvider>
      </body>
    </html>
  );
}
