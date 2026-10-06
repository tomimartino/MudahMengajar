import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
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
    <html lang="id" className={`${jakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
