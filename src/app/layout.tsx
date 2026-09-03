import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
import { CartProvider } from "@/context/CartContext";
import { BottomNavigation } from "@/components/ui/BottomNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apple Premium Store",
  description: "Premium Apple products, genuine-quality replacement parts and accessories.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-primary/30">
        <ThemeProvider>
          <CartProvider>
            <div className="flex flex-col min-h-screen bg-background w-full max-w-[480px] mx-auto sm:border-x sm:border-border sm:shadow-2xl sm:my-0 pb-[calc(72px+env(safe-area-inset-bottom)+1.5rem)] relative overflow-hidden">
              <main className="flex-1 w-full h-full overflow-x-hidden">
                {children}
              </main>
              <BottomNavigation />
            </div>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
