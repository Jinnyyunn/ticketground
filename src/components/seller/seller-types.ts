export type SellerSession = {
  readonly id: string;
  readonly applicationId: string;
  readonly organizationName: string;
  readonly username: string;
  readonly active: boolean;
  readonly mustChangePassword: boolean;
  readonly csrf: string;
};

export type SellerEventPublishStatus = "DRAFT" | "PENDING_ADMIN_REVIEW" | "PUBLISHED";

export type SellerEventPrice = { readonly grade: string; readonly seat: string; readonly price: number; readonly seatCount?: number };
export type SellerEventSchedule = { readonly label: string; readonly date: string; readonly times: readonly string[] };

export type SellerEvent = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly category: string;
  readonly venueId: string;
  readonly venue: string;
  readonly date: string;
  readonly schedules: readonly SellerEventSchedule[];
  readonly prices: readonly SellerEventPrice[];
  readonly casts: readonly string[];
  readonly notices: readonly string[];
  readonly summary: string;
  readonly publishStatus: SellerEventPublishStatus;
  readonly ticketCount: number;
  readonly soldCount: number;
  readonly updatedAt: string | null;
};

export type SellerVenue = { readonly id: string; readonly name: string };

export const sellerEventCategoryOptions = [
  { label: "뮤지컬", value: "musical" },
  { label: "콘서트", value: "concert" },
  { label: "연극", value: "theater" },
  { label: "클래식", value: "classic" },
  { label: "스포츠", value: "sports" },
  { label: "전시/행사", value: "exhibition" },
  { label: "아동/가족", value: "children" },
] as const;

export const sellerPublishStatusLabels: Record<SellerEventPublishStatus, string> = {
  DRAFT: "반려됨(수정 후 재등록 필요)",
  PENDING_ADMIN_REVIEW: "검토 대기",
  PUBLISHED: "게시됨",
};
