import type { Metadata } from "next";
import { SeatDesigner } from "@/components/seat-designer/seat-designer";

export const metadata: Metadata = {
  title: "좌석 배치 디자이너 · Ticketground",
  description: "seats.io Large theatre 스타일 인터랙티브 좌석 배치 에디터",
};

export default function SeatDesignerPage() {
  return <SeatDesigner />;
}
