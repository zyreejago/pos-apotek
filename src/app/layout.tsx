import type { Metadata } from "next";
import Script from "next/script";
import { Poppins } from "next/font/google";
import "./globals.css";
import { GoeyToaster } from "@/components/ui/goey-toaster";
import AuthProvider from "@/components/AuthProvider";
import { OffCanvasProvider } from "@/context/OffCanvasContext";
import { HeaderProvider } from "@/context/HeaderContext";
import { KeyboardShortcutsProvider } from "@/context/KeyboardShortcutsContext";
import { SidebarProvider } from "@/context/SidebarContext";
import MainLayout from "@/components/MainLayout";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Apotek Sumber Waras",
  description: "Point of Sales System",
  icons: [{ rel: "icon", url: "/logo.png" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="Mid-client-xuNHby_qkzOxDK5D" strategy="afterInteractive" />
      </head>
      <body className={`${poppins.variable} antialiased h-screen bg-gray-50 font-sans overflow-hidden`}>
        <OffCanvasProvider>
          <AuthProvider>
            <HeaderProvider>
              <SidebarProvider>
                <KeyboardShortcutsProvider>
                  <MainLayout>{children}</MainLayout>
                </KeyboardShortcutsProvider>
              </SidebarProvider>
            </HeaderProvider>
            <GoeyToaster />
          </AuthProvider>
        </OffCanvasProvider>
      </body>
    </html>
  );
}
