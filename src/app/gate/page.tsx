import type { Metadata } from "next";
import { GateScannerPanel } from "@/components/gate/gate-scanner-panel";

export const metadata: Metadata = {
  title: "게이트 스캐너 | Ticketground",
  robots: { index: false, follow: false },
  manifest: "/gate-manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "게이트 스캐너" },
};

export default function GatePage() {
  return <GateScannerPanel />;
}
