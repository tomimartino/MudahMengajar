import type { Metadata } from "next";
import { IBM_Plex_Mono, Nunito, Pixelify_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import "./appearance.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const playfulFont = Nunito({ variable: "--font-playful", subsets: ["latin"], preload: false });
const pixelFont = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"], preload: false });
const terminalFont = IBM_Plex_Mono({
  variable: "--font-terminal",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "MudahMengajar — Administrasi Bimbel",
    template: "%s — MudahMengajar",
  },
  description:
    "Dashboard administrasi untuk guru bimbel dan les privat: siswa, jadwal, presensi, pembelajaran, paket, pembayaran, dan laporan dalam satu tempat.",
  appleWebApp: {
    capable: true,
    title: "MudahMengajar",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakartaSans.variable} ${playfulFont.variable} ${pixelFont.variable} ${terminalFont.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
