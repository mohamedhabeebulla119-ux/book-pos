import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { AppShell } from "@/components/ui/AppShell";
import "../globals.css";

export const metadata: Metadata = {
  title: "Apple Premium Store",
  description: "Premium Apple products, genuine-quality replacement parts and accessories.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3faf6" },
    { media: "(prefers-color-scheme: dark)", color: "#08110d" },
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
            <WishlistProvider>
              <AppShell>{children}</AppShell>
            </WishlistProvider>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
