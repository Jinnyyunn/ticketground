import type { ChartDocument, ChartObject, Point, RowObject, SectionObject } from "@/types/seat-chart";
import { createRow, createSection } from "./chart-ops";
import { uid } from "./geometry";

const CAT = {
  premium: { key: "1", label: "프리미엄", color: "#f4a261" },
  stalls: { key: "2", label: "스톨", color: "#90c97a" },
  circle: { key: "3", label: "서클", color: "#7eb6e8" },
  choir: { key: "4", label: "합창석", color: "#e07a8a" },
  ga: { key: "5", label: "기타/입석", color: "#c4b5a0" },
} as const;

function wedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number,
): Point[] {
  const steps = 10;
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = a0 + ((a1 - a0) * i) / steps;
    outer.push({ x: cx + Math.cos(t) * rOuter, y: cy + Math.sin(t) * rOuter });
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = a0 + ((a1 - a0) * i) / steps;
    inner.push({ x: cx + Math.cos(t) * rInner, y: cy + Math.sin(t) * rInner });
  }
  return [...outer, ...inner];
}

function fillRowsInWedge(
  labelPrefix: string,
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number,
  rowCount: number,
  seatsPerRow: number,
  categoryKey: string,
): RowObject[] {
  const rows: RowObject[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const t = rowCount === 1 ? 0.5 : r / (rowCount - 1);
    const radius = rInner + (rOuter - rInner) * (0.12 + t * 0.76);
    const pad = 0.06 * (a1 - a0);
    const start: Point = {
      x: cx + Math.cos(a0 + pad) * radius,
      y: cy + Math.sin(a0 + pad) * radius,
    };
    const end: Point = {
      x: cx + Math.cos(a1 - pad) * radius,
      y: cy + Math.sin(a1 - pad) * radius,
    };
    const rowLabel = `${labelPrefix}${String.fromCharCode(65 + r)}`;
    rows.push(createRow(start, end, seatsPerRow, rowLabel, categoryKey, 0));
  }
  return rows;
}

function sectionWithRows(
  label: string,
  points: Point[],
  rows: RowObject[],
  categoryKey: string,
  fill: string,
): SectionObject {
  return createSection(points, label, categoryKey, fill, rows);
}

export function buildLargeTheatreChart(): ChartDocument {
  const cx = 900;
  const cy = 820;
  const objects: ChartObject[] = [];

  // 무대 — single shape (label drawn on rect only; no extra text/icon to avoid overlap)
  objects.push({
    id: uid("rect"),
    type: "rectangle",
    label: "무대",
    layer: "foreground",
    x: cx - 70,
    y: cy - 220,
    width: 140,
    height: 48,
    fill: "#6b7280",
    stroke: "#4b5563",
  });

  // 골든 서클 (상단 중앙)
  {
    const pts = wedge(cx, cy, 95, 145, -Math.PI * 0.72, -Math.PI * 0.28);
    const rows = fillRowsInWedge("GC", cx, cy, 100, 140, -Math.PI * 0.7, -Math.PI * 0.3, 3, 18, CAT.premium.key);
    objects.push(sectionWithRows("골든 서클", pts, rows, CAT.premium.key, "#7eb6e8"));
  }

  // Arena center (rectangle block of seats)
  {
    const aw = 160;
    const ah = 120;
    const pts: Point[] = [
      { x: cx - aw / 2, y: cy - ah / 2 },
      { x: cx + aw / 2, y: cy - ah / 2 },
      { x: cx + aw / 2, y: cy + ah / 2 },
      { x: cx - aw / 2, y: cy + ah / 2 },
    ];
    const rows: RowObject[] = [];
    for (let r = 0; r < 10; r += 1) {
      const y = cy - ah / 2 + 10 + r * 11;
      rows.push(
        createRow(
          { x: cx - aw / 2 + 10, y },
          { x: cx + aw / 2 - 10, y },
          14,
          `AR${String.fromCharCode(65 + r)}`,
          CAT.premium.key,
        ),
      );
    }
    objects.push(sectionWithRows("아레나", pts, rows, CAT.premium.key, "#f4a261"));
  }

  // Sections A–F around arena (hex-ish ring)
  const sectionDefs: { label: string; a0: number; a1: number }[] = [
    { label: "Section A", a0: -Math.PI * 0.85, a1: -Math.PI * 0.55 },
    { label: "Section B", a0: -Math.PI * 1.15, a1: -Math.PI * 0.85 },
    { label: "Section C", a0: Math.PI * 0.55, a1: Math.PI * 0.85 },
    { label: "Section D", a0: Math.PI * 0.25, a1: Math.PI * 0.55 },
    { label: "Section E", a0: -Math.PI * 0.25, a1: Math.PI * 0.05 },
    { label: "Section F", a0: Math.PI * 0.05, a1: Math.PI * 0.25 },
  ];
  // Better placement: left and right of arena as trapezoids
  const trapSections: { label: string; pts: Point[] }[] = [
    {
      label: "Section A",
      pts: [
        { x: cx - 30, y: cy - 55 },
        { x: cx + 30, y: cy - 55 },
        { x: cx + 55, y: cy - 10 },
        { x: cx - 55, y: cy - 10 },
      ],
    },
    {
      label: "Section B",
      pts: [
        { x: cx - 80, y: cy - 40 },
        { x: cx - 35, y: cy - 55 },
        { x: cx - 55, y: cy + 10 },
        { x: cx - 95, y: cy + 25 },
      ],
    },
    {
      label: "Section C",
      pts: [
        { x: cx - 95, y: cy + 30 },
        { x: cx - 55, y: cy + 15 },
        { x: cx - 55, y: cy + 55 },
        { x: cx - 90, y: cy + 70 },
      ],
    },
    {
      label: "Section D",
      pts: [
        { x: cx + 55, y: cy + 15 },
        { x: cx + 95, y: cy + 30 },
        { x: cx + 90, y: cy + 70 },
        { x: cx + 55, y: cy + 55 },
      ],
    },
    {
      label: "Section E",
      pts: [
        { x: cx + 35, y: cy - 55 },
        { x: cx + 80, y: cy - 40 },
        { x: cx + 95, y: cy + 25 },
        { x: cx + 55, y: cy + 10 },
      ],
    },
    {
      label: "Section F",
      pts: [
        { x: cx - 55, y: cy - 10 },
        { x: cx + 55, y: cy - 10 },
        { x: cx + 70, y: cy + 50 },
        { x: cx - 70, y: cy + 50 },
      ],
    },
  ];
  // Use angular sections for A-F in premium ring between arena and stalls
  void trapSections;
  void sectionDefs;
  const af: { label: string; a0: number; a1: number }[] = [
    { label: "Section A", a0: -2.1, a1: -1.55 },
    { label: "Section B", a0: -2.65, a1: -2.1 },
    { label: "Section C", a0: 2.1, a1: 2.65 },
    { label: "Section D", a0: 1.55, a1: 2.1 },
    { label: "Section E", a0: -0.55, a1: 0.0 },
    { label: "Section F", a0: 0.0, a1: 0.55 },
  ];
  // Actually place A-F as the six sides immediately around arena (orange)
  const arenaRing: { label: string; a0: number; a1: number }[] = [
    { label: "Section A", a0: -Math.PI / 2 - 0.45, a1: -Math.PI / 2 + 0.45 },
    { label: "Section B", a0: -Math.PI / 2 - 1.35, a1: -Math.PI / 2 - 0.45 },
    { label: "Section C", a0: Math.PI / 2 + 0.45, a1: Math.PI / 2 + 1.35 },
    { label: "Section D", a0: Math.PI / 2 - 0.45, a1: Math.PI / 2 + 0.45 },
    { label: "Section E", a0: -0.45, a1: 0.45 },
    { label: "Section F", a0: Math.PI - 0.45, a1: Math.PI + 0.45 },
  ];
  void af;
  // Override with visual layout matching screenshot more closely:
  // A top of arena, B left-top, C left-bottom, D right-bottom, E right-top, F bottom of arena... 
  // From image: A top, B left, C bottom-left, D bottom-right, E right, F top-right of orange block.
  // We'll use simple trapezoids around the arena rectangle.
  const orangeSections: { label: string; code: string; pts: Point[]; a0: number; a1: number }[] = [
    {
      label: "A구역",
      code: "A",
      pts: [
        { x: cx - 50, y: cy - 95 },
        { x: cx + 50, y: cy - 95 },
        { x: cx + 70, y: cy - 62 },
        { x: cx - 70, y: cy - 62 },
      ],
      a0: -2.0,
      a1: -1.15,
    },
    {
      label: "B구역",
      code: "B",
      pts: [
        { x: cx - 115, y: cy - 55 },
        { x: cx - 72, y: cy - 62 },
        { x: cx - 72, y: cy + 5 },
        { x: cx - 125, y: cy + 20 },
      ],
      a0: -2.6,
      a1: -2.0,
    },
    {
      label: "C구역",
      code: "C",
      pts: [
        { x: cx - 125, y: cy + 25 },
        { x: cx - 72, y: cy + 10 },
        { x: cx - 72, y: cy + 62 },
        { x: cx - 115, y: cy + 75 },
      ],
      a0: 2.0,
      a1: 2.6,
    },
    {
      label: "D구역",
      code: "D",
      pts: [
        { x: cx + 72, y: cy + 10 },
        { x: cx + 125, y: cy + 25 },
        { x: cx + 115, y: cy + 75 },
        { x: cx + 72, y: cy + 62 },
      ],
      a0: 0.55,
      a1: 1.15,
    },
    {
      label: "E구역",
      code: "E",
      pts: [
        { x: cx + 72, y: cy - 62 },
        { x: cx + 115, y: cy - 55 },
        { x: cx + 125, y: cy + 20 },
        { x: cx + 72, y: cy + 5 },
      ],
      a0: -0.55,
      a1: 0.0,
    },
    {
      label: "F구역",
      code: "F",
      pts: [
        { x: cx - 70, y: cy + 62 },
        { x: cx + 70, y: cy + 62 },
        { x: cx + 50, y: cy + 95 },
        { x: cx - 50, y: cy + 95 },
      ],
      a0: 1.15,
      a1: 2.0,
    },
  ];
  void arenaRing;

  for (const s of orangeSections) {
    // Generate rows as parallel lines inside bbox
    const xs = s.pts.map((p) => p.x);
    const ys = s.pts.map((p) => p.y);
    const minX = Math.min(...xs) + 8;
    const maxX = Math.max(...xs) - 8;
    const minY = Math.min(...ys) + 8;
    const maxY = Math.max(...ys) - 8;
    const rows: RowObject[] = [];
    const rowN = 5;
    for (let i = 0; i < rowN; i += 1) {
      const y = minY + ((maxY - minY) * (i + 0.5)) / rowN;
      rows.push(
        createRow(
          { x: minX, y },
          { x: maxX, y },
          8,
          `${s.code}${i + 1}`,
          CAT.premium.key,
        ),
      );
    }
    objects.push(sectionWithRows(s.label, s.pts, rows, CAT.premium.key, "#f4a261"));
  }

  // Stalls G–O (green mid ring) — 8 wedges
  const stallLabels = ["Stalls G", "Stalls H", "Stalls J", "Stalls K", "Stalls L", "Stalls M", "Stalls O", "Stalls N"];
  // Screenshot order around: G top-left, H mid-left, J bottom-left, K bottom, L bottom-right, M mid-right, O top-right
  const stallAngles: { label: string; a0: number; a1: number }[] = [
    { label: "Stalls G", a0: -Math.PI * 0.95, a1: -Math.PI * 0.72 },
    { label: "Stalls H", a0: -Math.PI * 1.18, a1: -Math.PI * 0.95 },
    { label: "Stalls J", a0: Math.PI * 0.72, a1: Math.PI * 0.95 },
    { label: "Stalls K", a0: Math.PI * 0.55, a1: Math.PI * 0.72 },
    { label: "Stalls L", a0: Math.PI * 0.28, a1: Math.PI * 0.55 },
    { label: "Stalls M", a0: Math.PI * 0.05, a1: Math.PI * 0.28 },
    { label: "Stalls O", a0: -Math.PI * 0.28, a1: -Math.PI * 0.05 },
    { label: "Stalls N", a0: -Math.PI * 0.55, a1: -Math.PI * 0.28 },
  ];
  // Better match screenshot positions with absolute wedges in mid ring
  const stalls: { label: string; code: string; a0: number; a1: number }[] = [
    { label: "스톨 G", code: "G", a0: (-110 * Math.PI) / 180, a1: (-70 * Math.PI) / 180 },
    { label: "스톨 H", code: "H", a0: (-150 * Math.PI) / 180, a1: (-110 * Math.PI) / 180 },
    { label: "스톨 J", code: "J", a0: (150 * Math.PI) / 180, a1: (190 * Math.PI) / 180 },
    { label: "스톨 K", code: "K", a0: (110 * Math.PI) / 180, a1: (150 * Math.PI) / 180 },
    { label: "스톨 L", code: "L", a0: (70 * Math.PI) / 180, a1: (110 * Math.PI) / 180 },
    { label: "스톨 M", code: "M", a0: (30 * Math.PI) / 180, a1: (70 * Math.PI) / 180 },
    { label: "스톨 O", code: "O", a0: (-30 * Math.PI) / 180, a1: (10 * Math.PI) / 180 },
    { label: "스톨 N", code: "N", a0: (-70 * Math.PI) / 180, a1: (-30 * Math.PI) / 180 },
  ];
  void stallLabels;
  void stallAngles;

  const rStallIn = 175;
  const rStallOut = 280;
  for (const s of stalls) {
    const pts = wedge(cx, cy + 20, rStallIn, rStallOut, s.a0, s.a1);
    const rows = fillRowsInWedge(
      `ST${s.code}`,
      cx,
      cy + 20,
      rStallIn + 8,
      rStallOut - 8,
      s.a0,
      s.a1,
      6,
      16,
      CAT.stalls.key,
    );
    objects.push(sectionWithRows(s.label, pts, rows, CAT.stalls.key, "#90c97a"));
  }

  // 서클 P–Y (파란 외곽)
  const circles: { label: string; code: string; a0: number; a1: number }[] = [
    { label: "서클 P", code: "P", a0: (-130 * Math.PI) / 180, a1: (-95 * Math.PI) / 180 },
    { label: "서클 Q", code: "Q", a0: (-165 * Math.PI) / 180, a1: (-130 * Math.PI) / 180 },
    { label: "서클 R", code: "R", a0: (165 * Math.PI) / 180, a1: (200 * Math.PI) / 180 },
    { label: "서클 S", code: "S", a0: (130 * Math.PI) / 180, a1: (165 * Math.PI) / 180 },
    { label: "서클 T", code: "T", a0: (100 * Math.PI) / 180, a1: (130 * Math.PI) / 180 },
    { label: "서클 U", code: "U", a0: (70 * Math.PI) / 180, a1: (100 * Math.PI) / 180 },
    { label: "서클 V", code: "V", a0: (40 * Math.PI) / 180, a1: (70 * Math.PI) / 180 },
    { label: "서클 W", code: "W", a0: (10 * Math.PI) / 180, a1: (40 * Math.PI) / 180 },
    { label: "서클 X", code: "X", a0: (-25 * Math.PI) / 180, a1: (10 * Math.PI) / 180 },
    { label: "서클 Y", code: "Y", a0: (-60 * Math.PI) / 180, a1: (-25 * Math.PI) / 180 },
  ];
  const rCircleIn = 300;
  const rCircleOut = 420;
  for (const s of circles) {
    const pts = wedge(cx, cy + 30, rCircleIn, rCircleOut, s.a0, s.a1);
    const rows = fillRowsInWedge(
      `C${s.code}`,
      cx,
      cy + 30,
      rCircleIn + 10,
      rCircleOut - 10,
      s.a0,
      s.a1,
      5,
      20,
      CAT.circle.key,
    );
    objects.push(sectionWithRows(s.label, pts, rows, CAT.circle.key, "#7eb6e8"));
  }

  // 동/서 합창석
  objects.push(
    sectionWithRows(
      "동측 합창석",
      [
        { x: cx - 280, y: cy - 280 },
        { x: cx - 140, y: cy - 300 },
        { x: cx - 120, y: cy - 230 },
        { x: cx - 260, y: cy - 210 },
      ],
      fillChoirRows("EC", cx - 200, cy - 255, 5, 12, CAT.choir.key),
      CAT.choir.key,
      "#e07a8a",
    ),
  );
  objects.push(
    sectionWithRows(
      "서측 합창석",
      [
        { x: cx + 140, y: cy - 300 },
        { x: cx + 280, y: cy - 280 },
        { x: cx + 260, y: cy - 210 },
        { x: cx + 120, y: cy - 230 },
      ],
      fillChoirRows("WC", cx + 200, cy - 255, 5, 12, CAT.choir.key),
      CAT.choir.key,
      "#e07a8a",
    ),
  );

  return {
    id: "chart_large_theatre",
    name: "대형 극장 차트",
    categories: Object.values(CAT),
    objects: objects.map((o) => ({ ...o, floorId: "floor_1" })),
    floors: [
      { id: "floor_1", name: "1층", index: 1 },
      { id: "floor_2", name: "2층", index: 2 },
    ],
    activeFloorId: "floor_1",
    focalPoint: { x: cx, y: cy - 160 },
    venueType: "sectionsAndFloors",
    zones: [],
    published: false,
  };
}

function fillChoirRows(
  prefix: string,
  cx: number,
  cy: number,
  rows: number,
  seats: number,
  cat: string,
): RowObject[] {
  const out: RowObject[] = [];
  for (let i = 0; i < rows; i += 1) {
    const y = cy - 30 + i * 12;
    out.push(createRow({ x: cx - 55, y }, { x: cx + 55, y }, seats, `${prefix}${i + 1}`, cat));
  }
  return out;
}

/** @deprecated Prefer `emptyChart` / templates from `./templates` */
export function emptyChart(name = "새 차트"): ChartDocument {
  return {
    id: uid("chart"),
    name,
    categories: Object.values(CAT),
    objects: [],
    floors: [{ id: "floor_1", name: "1층", index: 1 }],
    activeFloorId: "floor_1",
    focalPoint: { x: 400, y: 300 },
  };
}
