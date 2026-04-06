import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Route Optimizer Fuel Map",
  description:
    "Search any origin and destination, view a live driving route, and estimate fuel stops along the way.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
