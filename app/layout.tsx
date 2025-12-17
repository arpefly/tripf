import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import UserMenu from "./components/UserMenu";

export const metadata: Metadata = {
  title: "TripF - Разделение расходов",
  description: "Приложение для разделения расходов между друзьями",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TripF",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TripF" />
      </head>
      <body>
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
          <div className="container mx-auto px-4 py-4 max-w-4xl flex justify-between items-center">
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
              TripF
            </Link>
            <UserMenu />
          </div>
        </header>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
