import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "FaxDirect — Epic EMS",
  description: "Send and receive faxes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <div className="flex min-h-screen">
            <Navbar />
            <main className="flex-1 ml-0 md:ml-64">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
