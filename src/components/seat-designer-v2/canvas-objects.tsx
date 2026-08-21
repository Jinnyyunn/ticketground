import {
  Accessibility,
  Coffee,
  DoorOpen,
  Footprints,
  Hammer,
  LogIn,
  PanelTop,
  Signpost,
  Star,
  Theater,
  TrafficCone,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  ChartObject,
  IconObject,
  Point,
  RectangleObject,
} from "@/types/seat-chart";
import { objectBounds } from "./object-transform";

type CanvasObjectsProps = {
  readonly objects: readonly ChartObject[];
  readonly selectedIds: readonly string[];
  readonly selectedSeatIds: readonly string[];
  readonly nodeMode: boolean;
};

function pointsValue(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function selectionBox(object: ChartObject): ReactNode {
  const bounds = objectBounds(object);
  return (
    <g data-testid="seat-designer-v2-selection-handles">
      <rect
        x={bounds.x - 5}
        y={bounds.y - 5}
        width={bounds.width + 10}
        height={bounds.height + 10}
        fill="none"
        stroke="#087ffa"
        strokeDasharray="4 3"
      />
      <circle
        cx={bounds.x - 5}
        cy={bounds.y - 5}
        r="4"
        fill="white"
        stroke="#087ffa"
      />
      <circle
        cx={bounds.x + bounds.width + 5}
        cy={bounds.y - 5}
        r="4"
        fill="white"
        stroke="#087ffa"
      />
      <circle
        cx={bounds.x - 5}
        cy={bounds.y + bounds.height + 5}
        r="4"
        fill="white"
        stroke="#087ffa"
      />
      <circle
        cx={bounds.x + bounds.width + 5}
        cy={bounds.y + bounds.height + 5}
        r="4"
        fill="white"
        stroke="#087ffa"
      />
      <circle
        cx={bounds.x + bounds.width / 2}
        cy={bounds.y - 22}
        r="5"
        fill="white"
        stroke="#087ffa"
      />
      <line
        x1={bounds.x + bounds.width / 2}
        y1={bounds.y - 5}
        x2={bounds.x + bounds.width / 2}
        y2={bounds.y - 17}
        stroke="#087ffa"
      />
    </g>
  );
}

function rectangleNode(object: RectangleObject): ReactNode {
  const transform = object.rotation
    ? `rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})`
    : undefined;
  if (object.shape === "ellipse")
    return (
      <ellipse
        cx={object.x + object.width / 2}
        cy={object.y + object.height / 2}
        rx={object.width / 2}
        ry={object.height / 2}
        fill={object.fill ?? "#d9dfe5"}
        fillOpacity={object.opacity ?? 0.68}
        stroke={object.stroke ?? "#6b7280"}
        transform={transform}
      />
    );
  if (object.shape === "polygon" && object.points)
    return (
      <polygon
        points={pointsValue(object.points)}
        fill={object.fill ?? "#d9dfe5"}
        fillOpacity={object.opacity ?? 0.68}
        stroke={object.stroke ?? "#6b7280"}
      />
    );
  return (
    <rect
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      fill={object.fill ?? "#d9dfe5"}
      fillOpacity={object.opacity ?? 0.68}
      stroke={object.stroke ?? "#6b7280"}
      transform={transform}
    />
  );
}

function iconNode(object: IconObject): ReactNode {
  const size = object.size ?? 40;
  const props = {
    x: object.position.x - size / 2,
    y: object.position.y - size / 2,
    width: size,
    height: size,
    color: object.color ?? "#495057",
    strokeWidth: 1.5,
  } as const;
  if (object.icon === "stage") return <Theater {...props} />;
  if (object.icon === "wc") return <Accessibility {...props} />;
  if (object.icon === "star") return <Star {...props} />;
  if (object.icon === "people") return <Users {...props} />;
  if (object.icon === "male" || object.icon === "female")
    return <User {...props} />;
  if (object.icon === "cone") return <TrafficCone {...props} />;
  if (object.icon === "entrance") return <LogIn {...props} />;
  if (object.icon === "emergencyExit") return <DoorOpen {...props} />;
  if (object.icon === "stairs") return <Footprints {...props} />;
  if (object.icon === "tools") return <Hammer {...props} />;
  if (object.icon === "signpost") return <Signpost {...props} />;
  if (object.icon === "elevator") return <PanelTop {...props} />;
  if (object.icon === "coffee") return <Coffee {...props} />;
  if (object.icon === "warning") return <TriangleAlert {...props} />;
  return <DoorOpen {...props} />;
}

function renderObject(
  object: ChartObject,
  selectedSeatIds: readonly string[],
): ReactNode {
  if (object.type === "row")
    return (
      <g>
        {object.seats.map((seat) => (
          <g key={seat.id}>
            <circle
              cx={seat.x}
              cy={seat.y}
              r="7"
              fill={selectedSeatIds.includes(seat.id) ? "#087ffa" : "#c4c9ce"}
              stroke={selectedSeatIds.includes(seat.id) ? "#0369c9" : "#59626b"}
              strokeWidth="1.5"
            />
            <text
              x={seat.x}
              y={seat.y + 3}
              textAnchor="middle"
              fontSize="7"
              fill="#30363c"
            >
              {seat.label}
            </text>
          </g>
        ))}
      </g>
    );
  if (object.type === "table")
    return (
      <g>
        {object.shape === "rectangle" ? (
          <rect
            x={object.center.x - (object.width ?? 120) / 2}
            y={object.center.y - (object.height ?? 36) / 2}
            width={object.width ?? 120}
            height={object.height ?? 36}
            rx="2"
            fill="#b4bdc6"
            stroke="#59626b"
            transform={
              object.rotation
                ? `rotate(${object.rotation} ${object.center.x} ${object.center.y})`
                : undefined
            }
          />
        ) : (
          <circle
            cx={object.center.x}
            cy={object.center.y}
            r={object.radius}
            fill="#b4bdc6"
            stroke="#59626b"
          />
        )}
        {object.seats.map((seat) => (
          <circle
            key={seat.id}
            cx={seat.x}
            cy={seat.y}
            r="7"
            fill="#c4c9ce"
            stroke="#59626b"
          />
        ))}
      </g>
    );
  if (object.type === "rectangle") return rectangleNode(object);
  if (object.type === "booth")
    return (
      <g
        transform={
          object.rotation
            ? `rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})`
            : undefined
        }
      >
        <rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rx="2"
          fill="#d9e4ec"
          stroke="#59626b"
        />
        <text
          x={object.x + object.width / 2}
          y={object.y + object.height / 2 + 4}
          textAnchor="middle"
          fontSize="11"
        >
          부스
        </text>
      </g>
    );
  if (object.type === "area")
    return object.shape === "ellipse" ? (
      <ellipse
        cx={((object.points[0]?.x ?? 0) + (object.points[2]?.x ?? 0)) / 2}
        cy={((object.points[0]?.y ?? 0) + (object.points[2]?.y ?? 0)) / 2}
        rx={
          Math.abs((object.points[2]?.x ?? 0) - (object.points[0]?.x ?? 0)) / 2
        }
        ry={
          Math.abs((object.points[2]?.y ?? 0) - (object.points[0]?.y ?? 0)) / 2
        }
        fill="#def1e7"
        stroke="#5a8a70"
      />
    ) : (
      <polygon
        points={pointsValue(object.points)}
        fill="#def1e7"
        stroke="#5a8a70"
      />
    );
  if (object.type === "section")
    return (
      <polygon
        points={pointsValue(object.points)}
        fill={object.fill ?? "#d9e9f8"}
        fillOpacity="0.7"
        stroke="#5c83a7"
      />
    );
  if (object.type === "line")
    return (
      <polyline
        points={pointsValue(object.points ?? [object.start, object.end])}
        fill="none"
        stroke={object.stroke ?? "#5b6570"}
        strokeWidth="3"
      />
    );
  if (object.type === "text")
    return (
      <text
        x={object.position.x}
        y={object.position.y}
        textAnchor={
          object.align === "left"
            ? "start"
            : object.align === "right"
              ? "end"
              : "middle"
        }
        fontSize={object.fontSize ?? 18}
        fontWeight={object.weight ?? 500}
        fill={object.color ?? "#333333"}
        transform={
          object.rotation
            ? `rotate(${object.rotation} ${object.position.x} ${object.position.y})`
            : undefined
        }
      >
        {object.text}
      </text>
    );
  if (object.type === "image")
    return (
      <image
        href={object.href}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        opacity={object.opacity ?? 1}
        transform={
          object.rotation
            ? `rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})`
            : undefined
        }
        preserveAspectRatio="xMidYMid meet"
      />
    );
  return (
    <g
      transform={
        object.rotation
          ? `rotate(${object.rotation} ${object.position.x} ${object.position.y})`
          : undefined
      }
    >
      {iconNode(object)}
    </g>
  );
}

export function CanvasObjects({
  objects,
  selectedIds,
  selectedSeatIds,
  nodeMode,
}: CanvasObjectsProps) {
  return (
    <>
      {objects.map((object) => (
        <g
          key={object.id}
          data-object-id={object.id}
          data-object-type={object.type}
        >
          {renderObject(object, selectedSeatIds)}
          {selectedIds.includes(object.id) && !object.locked && selectionBox(object)}
          {nodeMode &&
            selectedIds.includes(object.id) &&
            "points" in object &&
            object.points?.map((point, index) => (
              <circle
                key={`${object.id}-node-${index}`}
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke="#087ffa"
                data-testid="seat-designer-v2-node-handle"
              />
            ))}
        </g>
      ))}
    </>
  );
}
