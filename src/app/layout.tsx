import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QurilPro — Qurilish firmasi boshqaruv tizimi",
  description:
    "Ishchilarni obyektlarga yuborish, davomat (keldi/kelmadi), kunlik ish haqi hisob-kitobi va to'lovlar — online, telefon va kompyuterdan ishlaydi. Hisobotlarni Excel va PDF qilib yuklab olish mumkin.",
  keywords: ["qurilish", "davomat", "ish haqi", "hisob-kitob", "ishchilar", "construction", "attendance"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

// Telefon brauzerlarida to'g'ri ko'rinish: notch ekranlar uchun safe-area va
// klaviatura ochilganda layout to'g'ri moslashishi uchun
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
