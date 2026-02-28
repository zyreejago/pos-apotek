import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { GoeyToaster } from "@/components/ui/goey-toaster";
import AuthProvider from "@/components/AuthProvider";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Apotek Sumber Waras",
  description: "Point of Sales System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} antialiased flex h-screen bg-gray-50 font-sans`}
      >
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <GoeyToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
