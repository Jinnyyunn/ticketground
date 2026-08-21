export const V2_TOOL_IDS = [
  "select", "seatSelect", "brush", "sameType", "node", "focal", "row", "segmentedRow", "multipleRows",
  "section", "roundTable", "rectangularTable", "booth", "rectangularArea",
  "ellipticArea", "polygonalArea", "rectangle", "ellipse", "polygon", "line",
  "text", "image", "icon", "hand",
] as const;

export type V2ToolId = (typeof V2_TOOL_IDS)[number];

export type V2ToolSpec = {
  readonly id: V2ToolId;
  readonly label: string;
  readonly shortcut?: string;
  readonly group?: "row" | "table" | "area" | "shape";
  readonly help: readonly string[];
};

const SELECT_TOOL: V2ToolSpec = { id: "select", label: "선택", shortcut: "V", help: ["클릭", "객체 선택", "Shift", "선택 추가"] };

export const V2_TOOLS: readonly V2ToolSpec[] = [
  SELECT_TOOL,
  { id: "seatSelect", label: "좌석 선택", shortcut: "X", help: ["클릭", "좌석 선택"] },
  { id: "brush", label: "선택 브러시", shortcut: "C", help: ["드래그", "좌석 선택", "Alt", "선택 제외"] },
  { id: "sameType", label: "같은 유형 선택", shortcut: "Z", help: ["클릭", "같은 유형 모두 선택"] },
  { id: "node", label: "노드", shortcut: "A", help: ["드래그", "노드 이동", "우클릭", "노드 제거"] },
  { id: "focal", label: "초점", shortcut: "F", help: ["클릭", "초점 배치"] },
  { id: "row", label: "행", shortcut: "R", group: "row", help: ["클릭 & 드래그", "행 그리기", "Shift", "15° 각도 고정", "Alt", "스냅 해제"] },
  { id: "segmentedRow", label: "구간 행", group: "row", help: ["클릭", "경로 노드 추가", "마지막 좌석 클릭 / Enter", "행 완료", "Shift", "15° 각도 고정", "Alt", "스냅 해제"] },
  { id: "multipleRows", label: "여러 행", group: "row", help: ["1차 드래그", "기준 행", "2차 드래그", "행 수·깊이", "Shift", "축 정렬", "Alt", "스냅 해제"] },
  { id: "section", label: "구역", shortcut: "S", group: "row", help: ["클릭", "노드 추가", "Enter", "구역 완료"] },
  { id: "roundTable", label: "원형 테이블", shortcut: "E", group: "table", help: ["클릭", "원형 테이블 배치", "Alt", "스냅 해제"] },
  { id: "rectangularTable", label: "직사각형 테이블", group: "table", help: ["클릭", "직사각형 테이블 배치", "Alt", "스냅 해제"] },
  { id: "booth", label: "부스", shortcut: "B", help: ["클릭", "부스 배치", "Alt", "스냅 해제"] },
  { id: "rectangularArea", label: "직사각형 영역", shortcut: "G", group: "area", help: ["드래그", "영역 그리기"] },
  { id: "ellipticArea", label: "타원 영역", group: "area", help: ["드래그", "타원 영역 그리기"] },
  { id: "polygonalArea", label: "다각형 영역", group: "area", help: ["클릭", "노드 추가", "Enter", "영역 완료"] },
  { id: "rectangle", label: "사각형", shortcut: "H", group: "shape", help: ["드래그", "사각형 그리기"] },
  { id: "ellipse", label: "타원", group: "shape", help: ["드래그", "타원 그리기"] },
  { id: "polygon", label: "다각형", group: "shape", help: ["클릭", "노드 추가", "Enter", "다각형 완료"] },
  { id: "line", label: "선", shortcut: "L", help: ["클릭", "노드 추가", "Enter", "선 완료"] },
  { id: "text", label: "텍스트", shortcut: "T", help: ["클릭", "텍스트 배치"] },
  { id: "image", label: "이미지", shortcut: "I", help: ["클릭", "이미지 배치"] },
  { id: "icon", label: "아이콘", shortcut: "O", help: ["클릭", "아이콘 배치"] },
  { id: "hand", label: "이동", help: ["드래그", "캔버스 이동"] },
] as const;

export function toolSpec(id: V2ToolId): V2ToolSpec {
  return V2_TOOLS.find((tool) => tool.id === id) ?? SELECT_TOOL;
}
