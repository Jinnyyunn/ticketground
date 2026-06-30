export type ResaleTab = "sell" | "find";

export type OwnedSeatOption = {
  readonly faceValue: number;
  readonly id: string;
  readonly label: string;
};

export type PoolCell = {
  readonly highlighted: boolean;
  readonly id: string;
};

export const resaleTabs = [
  { label: "팔기", value: "sell" },
  { label: "구하기", value: "find" },
] as const;

export const gradeOptions: readonly string[] = ["VIP", "R", "S", "A"];
export const zoneOptions: readonly string[] = ["1층 중앙", "1층 사이드", "2층", "오케스트라"];

export const matchCandidates = [
  { seat: "VIP H-14", grade: "VIP", zone: "1층 중앙", amount: 180500, pair: true, seed: "0x7ce91340", ledger: "#10515" },
  { seat: "VIP H-15", grade: "VIP", zone: "1층 중앙", amount: 182000, pair: true, seed: "0x4a5f2k9b", ledger: "#10516" },
  { seat: "R G-09", grade: "R", zone: "1층 사이드", amount: 152000, pair: false, seed: "0x91ab304c", ledger: "#10517" },
  { seat: "S K-21", grade: "S", zone: "2층", amount: 114000, pair: false, seed: "0x2f80ac11", ledger: "#10518" },
] as const;

export type MatchCandidate = (typeof matchCandidates)[number];

export function createPoolCells(): readonly PoolCell[] {
  return Array.from({ length: 60 }, (_, index) => ({
    id: `pool-${index + 1}`,
    highlighted: index % 7 === 0 || index % 11 === 0,
  }));
}

export function feeFor(amount: number) {
  return Math.ceil(amount * 0.05);
}
