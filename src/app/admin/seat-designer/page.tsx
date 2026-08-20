import type { Metadata } from "next";
import { SeatDesigner } from "@/components/seat-designer/seat-designer";

export const metadata: Metadata = {
  title: "좌석 배치 디자이너 · Ticketground",
  description: "공연장 좌석 배치도를 직접 설계하고 게시하는 전문 에디터",
};

export default function SeatDesignerPage() {
  return <SeatDesigner />;
}
