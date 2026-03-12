import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AircraftPollingProvider, DataPollingProvider, MarketPollingProvider, AlertPollingProvider, AnalyticsPollingProvider, SignalPollingProvider } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meridian - Geospatial Market Intelligence",
  description: "Real-time market intelligence platform powered by 3D geospatial visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AircraftPollingProvider>
          <DataPollingProvider>
            <MarketPollingProvider>
              <AlertPollingProvider>
                <AnalyticsPollingProvider>
                  <SignalPollingProvider>
                    {children}
                  </SignalPollingProvider>
                </AnalyticsPollingProvider>
              </AlertPollingProvider>
            </MarketPollingProvider>
          </DataPollingProvider>
        </AircraftPollingProvider>
      </body>
    </html>
  );
}
