import type { ChartDocument, ChartObject, Point, RowObject } from "@/types/seat-chart";
import { createRow, createSection, createTable } from "./chart-ops";
import { uid } from "./geometry";
import { buildLargeTheatreChart } from "./large-theatre";

export type TemplateId = "large-theatre" | "small-theatre" | "gala-dinner" | "trade-show" | "blank";

export type ChartTemplate = {
  readonly id: TemplateId;
  readonly name: string;
  readonly description: string;
  /** Mini preview colors for the template card */
  readonly swatch: readonly string[];
  readonly build: () => ChartDocument;
};

const CAT = {
  premium: { key: "1", label: "프리미엄", color: "#f4a261" },
  stalls: { key: "2", label: "스톨", color: "#90c97a" },
  circle: { key: "3", label: "서클", color: "#7eb6e8" },
  choir: { key: "4", label: "합창석", color: "#e07a8a" },
  ga: { key: "5", label: "기타/입석", color: "#c4b5a0" },
  table: { key: "1", label: "테이블", color: "#c084fc" },
  vip: { key: "2", label: "VIP", color: "#f4a261" },
  standard: { key: "3", label: "일반", color: "#7eb6e8" },
  boothA: { key: "1", label: "부스 A", color: "#60a5fa" },
  boothB: { key: "2", label: "부스 B", color: "#34d399" },
  boothC: { key: "3", label: "부스 C", color: "#fbbf24" },
} as const;

function baseChart(
  id: string,
  name: string,
  categories: ChartDocument["categories"],
  objects: ChartObject[],
  focal: Point,
  venueType: ChartDocument["venueType"] = "sectionsAndFloors",
): ChartDocument {
  return {
    id: `${id}_${uid("v")}`,
    name,
    categories: [...categories],
    objects: objects.map((o) => ({ ...o, floorId: o.floorId ?? "floor_1" })),
    floors: [
      { id: "floor_1", name: "1층", index: 1 },
      ...(venueType === "sectionsAndFloors"
        ? [{ id: "floor_2", name: "2층", index: 2 } as const]
        : []),
    ],
    activeFloorId: "floor_1",
    focalPoint: focal,
    venueType,
    zones:
      venueType === "zones"
        ? [
            { id: "zone_a", name: "A존" },
            { id: "zone_b", name: "B존" },
          ]
        : [],
    published: false,
  };
}

export function buildSmallTheatreChart(): ChartDocument {
  const cx = 500;
  const cy = 420;
  const objects: ChartObject[] = [];
  const cats = [CAT.premium, CAT.stalls, CAT.circle];

  objects.push({
    id: uid("rect"),
    type: "rectangle",
    label: "무대",
    layer: "foreground",
    x: cx - 90,
    y: cy - 200,
    width: 180,
    height: 44,
    fill: "#6b7280",
    stroke: "#4b5563",
  });

  // Orchestra (front)
  {
    const rows: RowObject[] = [];
    for (let r = 0; r < 8; r += 1) {
      const y = cy - 120 + r * 14;
      const half = 70 + r * 4;
      rows.push(createRow({ x: cx - half, y }, { x: cx + half, y }, 14 + r, `OR${String.fromCharCode(65 + r)}`, CAT.premium.key));
    }
    objects.push(
      createSection(
        [
          { x: cx - 110, y: cy - 130 },
          { x: cx + 110, y: cy - 130 },
          { x: cx + 130, y: cy + 10 },
          { x: cx - 130, y: cy + 10 },
        ],
        "오케스트라",
        CAT.premium.key,
        "#f4a261",
        rows,
      ),
    );
  }

  // Stalls left / right
  for (const [label, side] of [
    ["스톨 좌", -1],
    ["스톨 우", 1],
  ] as const) {
    const rows: RowObject[] = [];
    for (let r = 0; r < 6; r += 1) {
      const y = cy - 40 + r * 16;
      const x0 = cx + side * 150;
      const x1 = cx + side * 240;
      rows.push(
        createRow(
          { x: Math.min(x0, x1), y },
          { x: Math.max(x0, x1), y },
          8,
          `${label}${r + 1}`,
          CAT.stalls.key,
        ),
      );
    }
    objects.push(
      createSection(
        [
          { x: cx + side * 140, y: cy - 50 },
          { x: cx + side * 250, y: cy - 50 },
          { x: cx + side * 250, y: cy + 70 },
          { x: cx + side * 140, y: cy + 70 },
        ],
        label,
        CAT.stalls.key,
        "#90c97a",
        rows,
      ),
    );
  }

  // Balcony
  {
    const rows: RowObject[] = [];
    for (let r = 0; r < 5; r += 1) {
      const y = cy + 100 + r * 14;
      const half = 160 - r * 8;
      rows.push(createRow({ x: cx - half, y }, { x: cx + half, y }, 18, `BL${String.fromCharCode(65 + r)}`, CAT.circle.key));
    }
    objects.push(
      createSection(
        [
          { x: cx - 180, y: cy + 90 },
          { x: cx + 180, y: cy + 90 },
          { x: cx + 150, y: cy + 180 },
          { x: cx - 150, y: cy + 180 },
        ],
        "발코니",
        CAT.circle.key,
        "#7eb6e8",
        rows,
      ),
    );
  }

  return baseChart("chart_small_theatre", "소극장 차트", cats, objects, { x: cx, y: cy - 170 });
}

export function buildGalaDinnerChart(): ChartDocument {
  const objects: ChartObject[] = [];
  const cats = [CAT.vip, CAT.table, CAT.standard];

  objects.push({
    id: uid("rect"),
    type: "rectangle",
    label: "무대",
    layer: "foreground",
    x: 380,
    y: 40,
    width: 240,
    height: 50,
    fill: "#6b7280",
    stroke: "#4b5563",
  });

  objects.push({
    id: uid("text"),
    type: "text",
    label: "안내",
    layer: "foreground",
    position: { x: 500, y: 120 },
    text: "갈라 디너",
    fontSize: 18,
    color: "#444",
  });

  // VIP front tables
  let n = 1;
  for (let i = 0; i < 4; i += 1) {
    const x = 220 + i * 160;
    objects.push(createTable({ x, y: 200 }, 32, 10, `VIP ${n}`, CAT.vip.key));
    n += 1;
  }

  // Main grid of round tables
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 180 + col * 140 + (row % 2) * 40;
      const y = 320 + row * 130;
      const cat = row === 0 ? CAT.vip.key : CAT.table.key;
      objects.push(createTable({ x, y }, 28, 8, `테이블 ${n}`, cat));
      n += 1;
    }
  }

  // Standing area
  objects.push({
    id: uid("area"),
    type: "area",
    label: "스탠딩 바",
    layer: "interactive",
    categoryKey: CAT.standard.key,
    points: [
      { x: 80, y: 780 },
      { x: 920, y: 780 },
      { x: 920, y: 880 },
      { x: 80, y: 880 },
    ],
    capacity: 80,
  });

  return baseChart("chart_gala_dinner", "갈라 디너 차트", cats, objects, { x: 500, y: 90 }, "simple");
}

export function buildTradeShowChart(): ChartDocument {
  const objects: ChartObject[] = [];
  const cats = [CAT.boothA, CAT.boothB, CAT.boothC];

  objects.push({
    id: uid("rect"),
    type: "rectangle",
    label: "메인 입구",
    layer: "foreground",
    x: 420,
    y: 20,
    width: 160,
    height: 36,
    fill: "#374151",
    stroke: "#111",
  });

  objects.push({
    id: uid("icon"),
    type: "icon",
    label: "입구 아이콘",
    layer: "foreground",
    position: { x: 500, y: 80 },
    icon: "entrance",
    size: 22,
  });

  // Aisles + booth blocks
  const aisleY = [120, 320, 520, 720];
  let booth = 1;
  for (let block = 0; block < 3; block += 1) {
    const y0 = aisleY[block] + 20;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const x = 80 + col * 110;
        const y = y0 + row * 80;
        const catKey = block === 0 ? CAT.boothA.key : block === 1 ? CAT.boothB.key : CAT.boothC.key;
        const color = block === 0 ? CAT.boothA.color : block === 1 ? CAT.boothB.color : CAT.boothC.color;
        objects.push({
          id: uid("booth"),
          type: "booth",
          label: `부스 ${String(booth).padStart(2, "0")}`,
          layer: "interactive",
          categoryKey: catKey,
          x,
          y,
          width: 90,
          height: 60,
        });
        // tint via category — booth uses category color in renderer
        void color;
        booth += 1;
      }
    }
  }

  // Central plaza
  objects.push({
    id: uid("area"),
    type: "area",
    label: "중앙 광장",
    layer: "interactive",
    categoryKey: CAT.boothA.key,
    points: [
      { x: 350, y: 300 },
      { x: 650, y: 300 },
      { x: 650, y: 500 },
      { x: 350, y: 500 },
    ],
    capacity: 200,
  });

  objects.push({
    id: uid("text"),
    type: "text",
    label: "광장 라벨",
    layer: "foreground",
    position: { x: 500, y: 400 },
    text: "중앙 광장",
    fontSize: 16,
    color: "#1e3a5f",
  });

  return baseChart("chart_trade_show", "전시회 차트", cats, objects, { x: 500, y: 50 }, "zones");
}

export function emptyChart(name = "새 차트"): ChartDocument {
  const chart = baseChart(
    "chart_blank",
    name,
    [CAT.premium, CAT.stalls, CAT.circle, CAT.choir, CAT.ga],
    [],
    { x: 400, y: 300 },
    "simple",
  );
  return { ...chart, focalPoint: undefined };
}

export const CHART_TEMPLATES: readonly ChartTemplate[] = [
  {
    id: "large-theatre",
    name: "대형 극장",
    description: "다층 원형 극장 · 구역·스톨·서클",
    swatch: ["#f4a261", "#90c97a", "#7eb6e8", "#e07a8a"],
    build: () => {
      const chart = buildLargeTheatreChart();
      // unique id so fit-to-view runs on each load
      return { ...chart, id: `${chart.id}_${uid("v")}` };
    },
  },
  {
    id: "small-theatre",
    name: "소극장",
    description: "오케스트라 · 스톨 · 발코니",
    swatch: ["#f4a261", "#90c97a", "#7eb6e8"],
    build: buildSmallTheatreChart,
  },
  {
    id: "gala-dinner",
    name: "갈라 디너",
    description: "원형 테이블 · VIP · 스탠딩",
    swatch: ["#f4a261", "#c084fc", "#7eb6e8"],
    build: buildGalaDinnerChart,
  },
  {
    id: "trade-show",
    name: "전시회",
    description: "부스 그리드 · 중앙 광장",
    swatch: ["#60a5fa", "#34d399", "#fbbf24"],
    build: buildTradeShowChart,
  },
  {
    id: "blank",
    name: "빈 차트",
    description: "처음부터 그리기",
    swatch: ["#e5e7eb", "#d1d5db"],
    build: () => emptyChart(),
  },
];

export function buildTemplate(id: TemplateId): ChartDocument {
  const t = CHART_TEMPLATES.find((x) => x.id === id);
  return (t ?? CHART_TEMPLATES[0]).build();
}

export function templateIdFromChart(chart: ChartDocument): TemplateId | null {
  if (chart.id.startsWith("chart_large_theatre")) return "large-theatre";
  if (chart.id.startsWith("chart_small_theatre")) return "small-theatre";
  if (chart.id.startsWith("chart_gala_dinner")) return "gala-dinner";
  if (chart.id.startsWith("chart_trade_show")) return "trade-show";
  if (chart.id.startsWith("chart_blank")) return "blank";
  return null;
}
