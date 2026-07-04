import { StarIcon, TicketIcon, UserIcon } from "@/components/icons";

export const utilityLinksBeforeAuth = [
  { label: "고객센터", href: "/help" },
] as const;

export const signedInUtilityLinks = [
  { label: "MY", href: "/mypage" },
] as const;

export const loginLink = { label: "로그인", href: "/login" } as const;
export const signupLink = { label: "회원가입", href: "/signup" } as const;

export const publicIconLinks = [
  { label: "관심공연", href: "/watchlist", Icon: StarIcon },
] as const;

export const signedInIconLinks = [
  { label: "예매내역", href: "/mypage#reservations", Icon: TicketIcon },
  { label: "MY", href: "/mypage", Icon: UserIcon },
] as const;

export const categoryHrefs: Record<string, string> = {
  홈: "/",
  뮤지컬: "/contents/genre/musical",
  콘서트: "/contents/genre/concert",
  연극: "/contents/genre/theater",
  클래식: "/contents/genre/classic",
  전시: "/contents/genre/exhibition",
  아동: "/contents/genre/children",
  스포츠: "/contents/genre/sports",
  랭킹: "/contents/ranking",
  "티켓오픈 캘린더": "/open",
  "티켓 재판매": "/resale",
  지역별: "/contents/region",
  공연장: "/place",
};
