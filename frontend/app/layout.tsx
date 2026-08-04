import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ProductSheet } from "@/components/ProductSheet";
import { ProtectedTrialSheet } from "@/components/ProtectedTrialBadge";
import { HealthPing } from "@/components/HealthPing";
import { MetricsDrawer } from "@/components/MetricsDrawer";
import { MotionProvider } from "@/components/MotionProvider";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Instamart — Mission Completion Copilot (prototype)",
  description:
    "Non-commercial academic prototype emulating Instamart's design language for research demonstration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="min-h-full">
        <div className="app-frame">
          <MotionProvider>
            {children}
            <ProductSheet />
            <ProtectedTrialSheet />
            <MetricsDrawer />
          </MotionProvider>
          <HealthPing />
        </div>
      </body>
    </html>
  );
}
