import type { TicketShow } from "@/types";

// Canonical English<->Korean category mapping, matching the admin backend's
// allowedCategories (backend/admin-event-content.js) and the TicketShow display union.
export const categoryEnToKo: Record<string, TicketShow["category"]> = {
  concert: "콘서트",
  musical: "뮤지컬",
  theater: "연극",
  classic: "클래식",
  sports: "스포츠",
  exhibition: "전시/행사",
  children: "아동/가족",
};

export const categoryKoToEn: Record<TicketShow["category"], string> = {
  "콘서트": "concert",
  "뮤지컬": "musical",
  "연극": "theater",
  "클래식": "classic",
  "스포츠": "sports",
  "전시/행사": "exhibition",
  "아동/가족": "children",
};
