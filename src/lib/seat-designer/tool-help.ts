import type { ToolMode } from "@/types/seat-chart";

export type ToolHelp = {
  readonly title: string;
  readonly instructions: readonly string[];
  readonly defaults?: readonly { readonly label: string; readonly value: string }[];
};

const help: Readonly<Record<ToolMode, ToolHelp>> = {
  select: { title: "선택", instructions: ["클릭하여 객체를 선택합니다.", "드래그하면 여러 객체를 선택합니다."] },
  selectSeats: { title: "좌석 선택", instructions: ["좌석을 클릭하거나 드래그하여 개별 좌석을 선택합니다."] },
  brush: { title: "선택 브러시", instructions: ["드래그하여 지나가는 좌석을 선택합니다.", "Alt를 누르면 선택에서 제거합니다."] },
  selectSame: { title: "같은 유형 선택", instructions: ["객체를 클릭하여 같은 유형을 모두 선택합니다."] },
  node: { title: "노드", instructions: ["노드를 드래그하여 이동합니다.", "변을 클릭하면 노드가 추가되고 노드를 보조 클릭하면 삭제됩니다."] },
  focal: { title: "초점", instructions: ["최적 좌석 계산의 기준이 될 위치를 클릭합니다."] },
  row: { title: "열", instructions: ["첫 좌석에서 마지막 좌석까지 드래그합니다.", "Shift는 15° 각도 고정, Alt는 격자 맞춤 해제입니다."], defaults: [{ label: "열 간격", value: "14 pt" }, { label: "좌석 간격", value: "5 pt" }] },
  rowSegmented: { title: "구간이 있는 열", instructions: ["경로의 노드를 차례로 클릭하고 Enter로 완료합니다.", "Shift는 15° 각도 고정, Alt는 격자 맞춤 해제입니다."], defaults: [{ label: "열 간격", value: "14 pt" }, { label: "좌석 간격", value: "5 pt" }] },
  rowsMultiple: { title: "여러 열", instructions: ["첫 열을 드래그하면 평행한 열 묶음이 생성됩니다.", "Shift는 15° 각도 고정, Alt는 격자 맞춤 해제입니다."], defaults: [{ label: "열 수", value: "5" }, { label: "열 간격", value: "14 pt" }, { label: "좌석 간격", value: "5 pt" }] },
  section: { title: "구역", instructions: ["경계 노드를 차례로 클릭하고 Enter로 완료합니다.", "보조 클릭으로 마지막 노드를 제거합니다."] },
  table: { title: "원형 테이블", instructions: ["캔버스를 클릭하여 테이블을 배치합니다."], defaults: [{ label: "의자", value: "6" }] },
  tableRound: { title: "원형 테이블", instructions: ["캔버스를 클릭하여 테이블을 배치합니다."], defaults: [{ label: "의자", value: "6" }] },
  tableRectangular: { title: "직사각형 테이블", instructions: ["클릭하면 기본 크기로, 드래그하면 원하는 크기로 배치합니다."], defaults: [{ label: "크기", value: "120 × 36 pt" }, { label: "위 / 아래", value: "4 / 4" }, { label: "왼쪽 / 오른쪽", value: "0 / 0" }] },
  booth: { title: "부스", instructions: ["클릭하거나 드래그하여 부스를 배치합니다.", "Alt를 누르면 격자 맞춤이 해제됩니다."], defaults: [{ label: "크기", value: "50 × 50 pt" }] },
  area: { title: "직사각형 영역", instructions: ["드래그하여 일반 입장 영역을 만듭니다."] },
  areaRectangle: { title: "직사각형 영역", instructions: ["드래그하여 일반 입장 영역을 만듭니다.", "Shift를 누르면 정사각형으로 제한합니다."] },
  areaEllipse: { title: "타원형 영역", instructions: ["드래그하여 타원형 일반 입장 영역을 만듭니다.", "Shift를 누르면 원으로 제한합니다."] },
  areaPolygon: { title: "다각형 영역", instructions: ["노드를 차례로 클릭하고 Enter로 완료합니다.", "보조 클릭으로 마지막 노드를 제거합니다."] },
  rectangle: { title: "사각형", instructions: ["드래그하여 도형을 만듭니다."] },
  shapeRectangle: { title: "사각형", instructions: ["드래그하여 사각형을 만듭니다.", "Shift를 누르면 정사각형으로 제한합니다."] },
  shapeEllipse: { title: "타원", instructions: ["드래그하여 타원을 만듭니다.", "Shift를 누르면 원으로 제한합니다."] },
  shapePolygon: { title: "다각형", instructions: ["노드를 차례로 클릭하고 Enter로 완료합니다.", "보조 클릭으로 마지막 노드를 제거합니다."] },
  line: { title: "선", instructions: ["노드를 차례로 클릭하고 Enter로 완료합니다.", "Shift는 45° 각도 고정, 보조 클릭은 마지막 노드 제거입니다."] },
  text: { title: "텍스트", instructions: ["캔버스를 클릭하고 텍스트를 입력합니다."] },
  image: { title: "이미지", instructions: ["캔버스를 클릭하거나 파일을 놓아 이미지를 불러옵니다."], defaults: [{ label: "파일", value: "PNG · JPEG · GIF · WEBP · SVG" }, { label: "최대 크기", value: "10 MB" }] },
  icon: { title: "아이콘", instructions: ["캔버스를 클릭하여 아이콘을 배치합니다."], defaults: [{ label: "크기", value: "40 pt" }] },
  hand: { title: "손", instructions: ["드래그하여 문서를 이동합니다.", "다른 도구에서도 Space를 누르는 동안 사용할 수 있습니다."] },
};

export function toolHelpFor(mode: ToolMode): ToolHelp {
  return help[mode];
}
