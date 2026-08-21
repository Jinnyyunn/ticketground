import {
  Armchair, Brush, CircleDot, Crosshair, Hand, ImageIcon, MousePointer2,
  Move3d, Pentagon, PersonStanding, RectangleHorizontal, Rows3, Shapes,
  SquareDashedMousePointer, Table2, TextCursorInput, Users,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import type { V2ToolId } from "./tool-catalog";

export function V2ToolIcon({ id }: { readonly id: V2ToolId }): ReactNode {
  const props = { className: "size-[var(--editor-tool-icon-size)]", strokeWidth: 1.8 } as const;
  switch (id) {
    case "select": return <MousePointer2 {...props} />;
    case "seatSelect": return <CircleDot {...props} />;
    case "brush": return <Brush {...props} />;
    case "sameType": return <Users {...props} />;
    case "node": return <Move3d {...props} />;
    case "focal": return <Crosshair {...props} />;
    case "row": return <Rows3 {...props} />;
    case "segmentedRow": return <Waypoints {...props} />;
    case "multipleRows": return <Rows3 {...props} />;
    case "section": return <Pentagon {...props} />;
    case "roundTable": return <Armchair {...props} />;
    case "rectangularTable": return <Table2 {...props} />;
    case "booth": return <SquareDashedMousePointer {...props} />;
    case "rectangularArea": return <RectangleHorizontal {...props} />;
    case "ellipticArea": return <CircleDot {...props} />;
    case "polygonalArea": return <Pentagon {...props} />;
    case "rectangle": return <RectangleHorizontal {...props} />;
    case "ellipse": return <CircleDot {...props} />;
    case "polygon": return <Pentagon {...props} />;
    case "line": return <Waypoints {...props} />;
    case "text": return <TextCursorInput {...props} />;
    case "image": return <ImageIcon {...props} />;
    case "icon": return <PersonStanding {...props} />;
    case "hand": return <Hand {...props} />;
    default: return <Shapes {...props} />;
  }
}
