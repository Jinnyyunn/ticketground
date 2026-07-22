import {
  BadgeCheck,
  Banknote,
  ClipboardCheck,
  LifeBuoy,
  PackagePlus,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Ticket,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkspaceKey } from "./console-workspaces";

export type AdminRole = { readonly key: string; readonly name: string };
export type Permission = { readonly key: string; readonly label: string; readonly group: string };
export type AdminEventPrice = { readonly grade: string; readonly seat: string; readonly price: number; readonly seatCount?: number };
export type AdminEventSchedule = { readonly label: string; readonly date: string; readonly times: readonly string[] };
export type AdminEventSummary = {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly saleState: string;
  readonly venue: string;
  readonly date?: string;
  readonly dates?: readonly { readonly id: string; readonly startsAt: string; readonly label: string }[];
  readonly ticketCount: number;
  readonly soldCount: number;
};
export type AdminSession = {
  readonly admin: {
    readonly id: string;
    readonly username: string;
    readonly roles: readonly AdminRole[];
    readonly permissions: readonly string[];
  };
  readonly csrf: string;
  readonly expiresAt: string;
  readonly roles: readonly AdminRole[];
  readonly permissionCatalog: readonly Permission[];
};
export type AdminEvent = {
  readonly id: string;
  readonly title: string;
  readonly shortTitle?: string;
  readonly category: string;
  readonly venueId: string;
  readonly venue: string;
  readonly date: string;
  readonly dates?: readonly { readonly id: string; readonly startsAt: string; readonly label: string }[];
  readonly period?: string;
  readonly runtime?: string;
  readonly ageLimit?: string;
  readonly badge?: string;
  readonly artistSlug?: string;
  readonly slug?: string;
  readonly prices?: readonly AdminEventPrice[];
  readonly schedules?: readonly AdminEventSchedule[];
  readonly casts?: readonly string[];
  readonly notices?: readonly string[];
  readonly summary?: string;
  readonly pinnedRank?: number | null;
  readonly saleState: string;
  readonly saleNote?: string;
  readonly checkoutNotice?: string;
  readonly discountRate?: number;
  readonly image?: string;
  readonly zones: readonly { readonly id: string; readonly name: string; readonly faceValue: number; readonly seatCount?: number }[];
};
export type Venue = { readonly id: string; readonly name: string };
export type AdminUser = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly trustScore: number;
  readonly sanctions: readonly { readonly id: string; readonly reason: string; readonly penalty: string; readonly at: string }[];
};
export type AdminTicket = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly seatLabel: string;
  readonly status: string;
  readonly ownerId: string | null;
  readonly faceValue: number;
};
export type SupportCategory = "GENERAL" | "PAYMENT" | "TICKET_QR" | "URGENT";
export type SupportThread = {
  readonly id: string;
  readonly userId: string;
  readonly subject?: string;
  readonly status: string;
  readonly category: SupportCategory;
  readonly priority: string;
  readonly messageCount: number;
  readonly lastMessagePreview: string;
  readonly relatedTicketId: string | null;
  readonly relatedBookingId: string | null;
  readonly messages: readonly { readonly id: string; readonly actorId: string; readonly role: string; readonly body: string; readonly at: string | null }[];
};

export type OverviewWorkspace = {
  readonly stats: {
    readonly totalTickets: number;
    readonly onSaleTickets: number;
    readonly supportOpen: number;
    readonly ledgerVerified: boolean;
    readonly todayPaymentCount: number;
    readonly todayPaymentAmount: number;
    readonly totalPaymentAmount: number;
    readonly totalPaymentFees: number;
    readonly totalSettlements: number;
  };
};
export type CatalogWorkspace = { readonly events: readonly AdminEvent[]; readonly eventSummaries?: readonly AdminEventSummary[]; readonly venues: readonly Venue[] };
export type InventoryWorkspace = {
  readonly eventSummaries: readonly AdminEventSummary[];
  readonly events: readonly AdminEvent[];
  readonly filters: { readonly eventId: string | null; readonly performanceDateId: string | null; readonly zoneId: string | null };
  readonly page: { readonly page: number; readonly limit: number; readonly total: number; readonly hasNext: boolean; readonly hasPrevious: boolean };
  readonly tickets: readonly AdminTicket[];
  readonly zoneSummary: readonly {
    readonly zoneId: string;
    readonly zoneName: string;
    readonly totalCount: number;
    readonly availableCount: number;
    readonly soldCount: number;
    readonly heldCount: number;
  }[];
};
export type PageInfo = { readonly page: number; readonly limit: number; readonly total: number; readonly hasNext: boolean; readonly hasPrevious: boolean };
export type AccountsWorkspace = { readonly filters: { readonly search: string | null }; readonly users: readonly AdminUser[] };
export type SupportWorkspace = { readonly filters: { readonly category: string | null; readonly status: string | null }; readonly supportThreads: readonly SupportThread[] };
export type FinanceWorkspace = {
  readonly eventSummaries: readonly AdminEventSummary[];
  readonly filters: { readonly eventId: string | null; readonly from: string | null; readonly method: string | null; readonly status: string | null; readonly to: string | null };
  readonly page: PageInfo;
  readonly summary: { readonly count: number; readonly totalAmount: number; readonly totalFees: number; readonly totalSettlements: number };
  readonly transactions: readonly {
    readonly id: string;
    readonly ticketId: string;
    readonly userId: string;
    readonly sellerId?: string;
    readonly type: string;
    readonly amount: number;
    readonly transferAmount: number;
    readonly platformFee: number;
    readonly method: string;
    readonly status: string;
    readonly pgTransactionId: string;
    readonly createdAt: string;
    readonly eventId: string | null;
    readonly eventTitle: string | null;
    readonly seatLabel: string | null;
  }[];
};
export type ResaleWorkspace = {
  readonly resalePools: readonly {
    readonly id: string;
    readonly eventTitle: string;
    readonly seatLabel: string;
    readonly sellerName: string;
    readonly zoneName: string;
    readonly status: string;
    readonly buyerCount?: number;
    readonly buyers?: readonly string[];
    readonly price: number;
    readonly createdAt: string;
    readonly cancelReason?: string;
  }[];
  readonly watchlist: readonly { readonly id: string }[];
  readonly notificationJobs: readonly { readonly id: string; readonly status: string }[];
  readonly operatorAlerts: readonly { readonly id: string; readonly message: string; readonly status: string; readonly createdAt?: string }[];
};
export type AdmissionWorkspace = {
  readonly admissionCredentials: readonly {
    readonly id: string;
    readonly ticketId: string;
    readonly userId: string;
    readonly status: string;
    readonly riskStatus?: string;
    readonly adminHold: boolean;
    readonly adminHoldReason: string | null;
    readonly adminHoldUpdatedAt: string | null;
  }[];
  readonly page: PageInfo;
  readonly qrIssueLogs: readonly {
    readonly id: string;
    readonly ticketId: string;
    readonly credentialId: string | null;
    readonly userId: string;
    readonly deviceId: string;
    readonly channel: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly traceCode: string;
  }[];
};
export type AuditWorkspace = {
  readonly filters: { readonly action: string | null; readonly actorId: string | null; readonly from: string | null; readonly to: string | null };
  readonly ledger: readonly { readonly index: number; readonly actorId: string; readonly action: string; readonly at: string; readonly payload: unknown }[];
  readonly page: PageInfo;
  readonly ledgerCheck: { readonly ok: boolean };
};
export type AdminAccount = {
  readonly id: string;
  readonly username: string;
  readonly roleKeys: readonly string[];
  readonly active: boolean;
  readonly ipAllowlist: readonly string[];
  readonly bootstrap?: boolean;
};
export type AclWorkspaceData = { readonly adminAccounts: readonly AdminAccount[] };
export type WorkspaceData = OverviewWorkspace | CatalogWorkspace | InventoryWorkspace | AccountsWorkspace | SupportWorkspace | FinanceWorkspace | ResaleWorkspace | AdmissionWorkspace | AuditWorkspace | AclWorkspaceData;
export type Feedback = { readonly tone: "error" | "success"; readonly message: string } | null;
export type Mutation = (path: string, body: Record<string, unknown>, success: string) => Promise<boolean>;

type WorkspaceDefinition = {
  readonly label: string;
  readonly heading: string;
  readonly description: string;
  readonly permission: string;
  readonly Icon: LucideIcon;
};

export const workspaceDefinitions = {
  overview: { label: "운영 현황", heading: "운영 현황", description: "오늘의 판매·지원·감사 신호를 빠르게 확인합니다.", permission: "admin.dashboard.read", Icon: ClipboardCheck },
  catalog: { label: "공연/상품", heading: "공연/상품", description: "신규 공연과 판매 가능한 상품을 등록합니다.", permission: "catalog.manage", Icon: PackagePlus },
  sales: { label: "판매 설정", heading: "판매 설정", description: "공연별 판매 상태와 가격을 조정합니다.", permission: "catalog.manage", Icon: Ticket },
  inventory: { label: "티켓 재고", heading: "티켓 재고", description: "판매 가능 티켓의 운영 보류 상태를 관리합니다.", permission: "catalog.manage", Icon: ClipboardCheck },
  accounts: { label: "계정", heading: "계정", description: "회원 신뢰도와 계정 상태를 검토합니다.", permission: "accounts.manage", Icon: UserCog },
  support: { label: "고객 지원", heading: "고객 지원", description: "열린 문의를 답변하고 처리 상태를 갱신합니다.", permission: "support.manage", Icon: LifeBuoy },
  finance: { label: "정산", heading: "정산", description: "결제 거래, 수수료, 판매자 정산 합계를 조회합니다.", permission: "finance.read", Icon: ReceiptText },
  resale: { label: "재판매/양도", heading: "재판매/양도", description: "재판매 풀을 강제 취소하고 운영 알림을 확인합니다.", permission: "finance.read", Icon: Banknote },
  admission: { label: "입장/QR", heading: "입장/QR", description: "입장 자격과 현장 리스크 상태를 확인합니다.", permission: "admission.manage", Icon: QrCode },
  audit: { label: "감사 원장", heading: "감사 원장", description: "최근 감사 원장과 체인 검증 상태를 확인합니다.", permission: "security.manage", Icon: BadgeCheck },
  acl: { label: "관리자/ACL", heading: "관리자/ACL", description: "관리자 계정, 역할, 접근 허용 IP를 관리합니다.", permission: "acl.read", Icon: ShieldCheck },
} satisfies Record<WorkspaceKey, WorkspaceDefinition>;

export const saleStates = ["ON_SALE", "OPEN_SOON", "DISCOUNT_SOON", "ADMIN_HOLD", "CLOSED"] as const;
export const userStatuses = ["ACTIVE", "WATCHLIST", "BANNED"] as const;
export const ticketStatuses = ["ON_SALE", "ADMIN_HOLD"] as const;
export const supportStatuses = ["OPEN", "ANSWERED", "CLOSED"] as const;
export const supportCategories = ["GENERAL", "PAYMENT", "TICKET_QR", "URGENT"] as const;

const operatorLabels: Record<string, string> = {
  ACTIVE: "활성",
  ADMIN_HOLD: "관리 보류",
  ANSWERED: "답변 완료",
  BANNED: "이용 제한",
  BANK_TRANSFER: "계좌이체",
  CLOSED: "종료",
  concert: "콘서트",
  CREDIT_CARD: "신용카드",
  DISCOUNT_SOON: "할인 예정",
  GENERAL: "일반",
  children: "아동·가족",
  classic: "클래식",
  exhibition: "전시·행사",
  festival: "페스티벌",
  musical: "뮤지컬",
  ON_SALE: "판매 중",
  OPEN: "접수 중",
  OPEN_SOON: "오픈 예정",
  PAID: "결제 완료",
  PAYMENT: "결제",
  PRIMARY: "일반 예매",
  RESALE: "공식 재판매",
  REFUND: "환불",
  REFUNDED: "환불 완료",
  MATCHED: "거래 완료",
  CANCELED: "취소됨",
  sports: "스포츠",
  TICKET_QR: "티켓/QR",
  theater: "연극",
  URGENT: "긴급",
  WATCHLIST: "주의 관찰"
};

export function operatorLabel(value: string): string {
  return operatorLabels[value] || value;
}

export function hasPermission(session: AdminSession | null, permission: string): boolean {
  return session?.admin.permissions.includes(permission) ?? false;
}
