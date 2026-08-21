import type { ToolId, ToolMode } from "@/types/seat-chart";

export type ToolChoice = {
  readonly mode: ToolMode;
  readonly label: string;
  readonly help: string;
};

export type ToolGroup = {
  readonly tool: ToolId;
  readonly label: string;
  readonly choices: readonly ToolChoice[];
};

export const toolGroups: readonly ToolGroup[] = [
  {
    tool: "row",
    label: "열 도구",
    choices: [
      { mode: "row", label: "열", help: "드래그하여 좌석 열을 만듭니다." },
      { mode: "rowSegmented", label: "구간이 있는 열", help: "노드를 이어 꺾인 좌석 열을 만듭니다." },
      { mode: "rowsMultiple", label: "여러 열", help: "첫 열을 드래그한 뒤 평행한 여러 열을 만듭니다." },
    ],
  },
  {
    tool: "table",
    label: "테이블 도구",
    choices: [
      { mode: "tableRound", label: "원형 테이블", help: "클릭하여 의자 6개가 있는 원형 테이블을 만듭니다." },
      { mode: "tableRectangular", label: "직사각형 테이블", help: "드래그하여 위 4개, 아래 4개 의자가 있는 테이블을 만듭니다." },
    ],
  },
  {
    tool: "area",
    label: "영역 도구",
    choices: [
      { mode: "areaRectangle", label: "직사각형 영역", help: "드래그하여 직사각형 일반 입장 영역을 만듭니다." },
      { mode: "areaEllipse", label: "타원형 영역", help: "드래그하여 타원형 일반 입장 영역을 만듭니다." },
      { mode: "areaPolygon", label: "다각형 영역", help: "노드를 이어 다각형 일반 입장 영역을 만듭니다." },
    ],
  },
  {
    tool: "rectangle",
    label: "도형 도구",
    choices: [
      { mode: "shapeRectangle", label: "사각형", help: "드래그하여 사각형을 만듭니다." },
      { mode: "shapeEllipse", label: "타원", help: "드래그하여 타원을 만듭니다." },
      { mode: "shapePolygon", label: "다각형", help: "노드를 이어 다각형 도형을 만듭니다." },
    ],
  },
];

const primaryByMode: Readonly<Partial<Record<ToolMode, ToolId>>> = {
  rowSegmented: "row",
  rowsMultiple: "row",
  tableRound: "table",
  tableRectangular: "table",
  areaRectangle: "area",
  areaEllipse: "area",
  areaPolygon: "area",
  shapeRectangle: "rectangle",
  shapeEllipse: "rectangle",
  shapePolygon: "rectangle",
};

const defaultModeByTool: Readonly<Partial<Record<ToolId, ToolMode>>> = {
  table: "tableRound",
  area: "areaRectangle",
  rectangle: "shapeRectangle",
};

export function primaryToolForMode(mode: ToolMode): ToolId {
  const primary = primaryByMode[mode];
  if (primary) return primary;
  switch (mode) {
    case "select":
    case "selectSeats":
    case "brush":
    case "selectSame":
    case "node":
    case "focal":
    case "row":
    case "section":
    case "table":
    case "booth":
    case "area":
    case "rectangle":
    case "line":
    case "text":
    case "image":
    case "icon":
    case "hand":
      return mode;
    default:
      throw new Error(`Unsupported tool mode: ${mode}`);
  }
}

export function defaultModeForTool(tool: ToolId): ToolMode {
  return defaultModeByTool[tool] ?? tool;
}

export function toolGroupFor(tool: ToolId): ToolGroup | undefined {
  return toolGroups.find((group) => group.tool === tool);
}
