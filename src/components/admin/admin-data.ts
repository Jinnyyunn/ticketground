export type PaneId = "ops" | "sales" | "inventory" | "map" | "accounts" | "scalping" | "inquiries" | "ledger";
export type AccountStatus = "정상" | "주의" | "차단";
export type VenueKey = "jamsil" | "kspo" | "nanji" | "blue";

export interface LedgerRow {
  readonly seq: number;
  readonly at: string;
  readonly prevHash: string;
  readonly event: string;
  readonly hash: string;
  readonly valid: boolean;
}

export interface SaleRow {
  readonly id: string;
  readonly title: string;
  readonly venue: string;
  readonly status: string;
  readonly openAt: string;
}

export const panes: readonly { readonly id: PaneId; readonly label: string }[] = [
  { id: "ops", label: "운영현황" },
  { id: "sales", label: "판매관리" },
  { id: "inventory", label: "좌석재고" },
  { id: "map", label: "좌석도 미리보기" },
  { id: "accounts", label: "계정관리" },
  { id: "scalping", label: "암표대응" },
  { id: "inquiries", label: "고객문의" },
  { id: "ledger", label: "감사 원장" },
];

export const salesRows: readonly SaleRow[] = [
  { id: "CTI-LM40", title: "레미제라블 40주년", venue: "블루스퀘어", status: "판매중", openAt: "2026.05.13 19:30" },
  { id: "CTI-IU26", title: "IU WORLD TOUR", venue: "잠실주경기장", status: "오픈대기", openAt: "2026.07.01 20:00" },
  { id: "CTI-BP26", title: "베를린필 내한", venue: "예술의전당", status: "검수중", openAt: "2026.09.12 17:00" },
];

export const initialLedgerRows: readonly LedgerRow[] = [
  { seq: 10513, at: "10:04:29", prevHash: "0x8f01c2aa", event: "reservation.confirmed CTI-260513-A4F2K9", hash: "0x4a5f2k9b", valid: true },
  { seq: 10514, at: "10:04:31", prevHash: "0x4a5f2k9b", event: "clean-ticket-issued dynamic-qr-hold", hash: "0x7ce91340", valid: true },
  { seq: 10515, at: "10:06:08", prevHash: "0x7ce91340", event: "resale-pool.lock VIP H-14", hash: "0x91aa730d", valid: true },
];

export const inventoryRows = [
  { zone: "VIP H열", total: 44, sold: 39, owner: "CTI-260513-A4F2K9" },
  { zone: "R D열", total: 52, sold: 18, owner: null },
  { zone: "S N열", total: 60, sold: 41, owner: "CTI-260514-Q7L2" },
  { zone: "A T열", total: 68, sold: 12, owner: null },
] as const;

export const accountRows = [
  { id: "kim-0421", name: "김하늘", trust: 94, trustClass: "w-[94%]", status: "정상" },
  { id: "park-bulk", name: "박대리", trust: 51, trustClass: "w-[51%]", status: "주의" },
  { id: "macro-77", name: "매크로 의심", trust: 18, trustClass: "w-[18%]", status: "차단" },
] as const;

export const venueBlocks: Record<VenueKey, readonly string[]> = {
  jamsil: ["1루 A", "1루 B", "중앙 VIP", "3루 A", "3루 B", "플로어"],
  kspo: ["F1", "F2", "2층 21", "2층 22", "3층 31", "3층 32"],
  nanji: ["스탠딩 A", "스탠딩 B", "피크닉", "사이드", "게이트"],
  blue: ["VIP H", "R D", "S N", "A T", "오케스트라"],
};
