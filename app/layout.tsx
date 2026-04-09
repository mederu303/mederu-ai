import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
const interSans = Inter({ variable: "--font-inter-sans", subsets: ["latin"] });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });
export const metadata: Metadata = { title: "mederu lineage", description: "AI art lineage on Etherlink" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interSans.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-zinc-100 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
