"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { ChartObject, SeatPlace } from "@/types/seat-chart";
import { countPlaces, fitViewportToChart, normalizeOverlay, objectCenter } from "@/lib/seat-designer/chart-ops";
import { polygonPath } from "@/lib/seat-designer/geometry";
import { ko, toolLabel } from "@/lib/seat-designer/i18n";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { cn } from "@/lib/utils";
import { marqueeObjectSelection, sameTypeSelection } from "@/lib/seat-designer/selection";

function categoryColor(
  chartCats: readonly { key: string; color: string }[],
  key?: string,
  fallback = "#94a3b8",
): string {
  return chartCats.find((c) => c.key === key)?.color ?? fallback;
}

function SeatDot({
  seat,
  color,
  selected,
  showLabel,
  onClick,
}: {
  seat: SeatPlace;
  color: string;
  selected: boolean;
  showLabel: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <g onClick={onClick} className="cursor-pointer">
      <circle
        cx={seat.x}
        cy={seat.y}
        r={selected ? 4.2 : 3.4}
        fill={color}
        stroke={selected ? "#0784fa" : "rgba(0,0,0,0.25)"}
        strokeWidth={selected ? 1.5 : 0.5}
      />
      {showLabel && (
        <text x={seat.x} y={seat.y - 6} textAnchor="middle" fontSize={7} fill="#444">
          {seat.label.split("-").pop()}
        </text>
      )}
    </g>
  );
}

function ObjectView({
  obj,
  chart,
  selected,
  selectedSeatIds,
  showContents,
  showLabels,
  dragOffset,
  onSelect,
  onSelectSeat,
  onBeginMove,
}: {
  obj: ChartObject;
  chart: SeatEditorApi["state"]["chart"];
  selected: boolean;
  selectedSeatIds: readonly string[];
  showContents: boolean;
  showLabels: boolean;
  dragOffset?: { x: number; y: number } | null;
  onSelect: (id: string, additive: boolean) => void;
  onSelectSeat: (id: string, additive: boolean) => void;
  onBeginMove: (id: string, e: ReactPointerEvent) => void;
}) {
  const catColor = categoryColor(chart.categories, obj.categoryKey, obj.type === "section" ? obj.fill : undefined);
  const stroke = selected ? "#0784fa" : "rgba(0,0,0,0.2)";
  const sw = selected ? 2 : 1;
  const ox = selected && dragOffset ? dragOffset.x : 0;
  const oy = selected && dragOffset ? dragOffset.y : 0;

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(obj.id, e.shiftKey || e.metaKey);
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    onBeginMove(obj.id, e);
  };

  const center = objectCenter(obj);
  const transforms = [
    ox || oy ? `translate(${ox} ${oy})` : "",
    obj.rotation ? `rotate(${obj.rotation} ${center.x} ${center.y})` : "",
  ].filter(Boolean).join(" ");
  const wrap = (children: ReactNode) => <g transform={transforms || undefined}>{children}</g>;

  if (obj.type === "section") {
    const fill = obj.fill ?? catColor;
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <path
          d={polygonPath(obj.points)}
          fill={fill}
          fillOpacity={0.55}
          stroke={stroke}
          strokeWidth={sw}
        />
        {(showLabels || selected) && (
          <text
            x={objectCenter(obj).x}
            y={objectCenter(obj).y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={600}
            fill="#333"
            className="pointer-events-none select-none"
          >
            {obj.label}
          </text>
        )}
        {showContents &&
          obj.nestedRows?.map((row) =>
            row.seats.map((seat) => (
              <SeatDot
                key={seat.id}
                seat={seat}
                color={categoryColor(chart.categories, seat.categoryKey ?? row.categoryKey ?? obj.categoryKey, fill)}
                selected={selectedSeatIds.includes(seat.id)}
                showLabel={showLabels}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSeat(seat.id, e.shiftKey || e.metaKey);
                }}
              />
            )),
          )}
      </g>,
    );
  }

  if (obj.type === "row") {
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <line
          x1={obj.start.x}
          y1={obj.start.y}
          x2={obj.end.x}
          y2={obj.end.y}
          stroke={selected ? "#0784fa" : "transparent"}
          strokeWidth={10}
        />
        {obj.seats.map((seat) => (
          <SeatDot
            key={seat.id}
            seat={seat}
            color={categoryColor(chart.categories, seat.categoryKey ?? obj.categoryKey)}
            selected={selectedSeatIds.includes(seat.id) || selected}
            showLabel={showLabels}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSeat(seat.id, e.shiftKey || e.metaKey);
            }}
          />
        ))}
        {(showLabels || selected) && (
          <text x={obj.start.x - 8} y={obj.start.y + 3} fontSize={9} fill="#555" className="pointer-events-none">
            {obj.label}
          </text>
        )}
      </g>,
    );
  }

  if (obj.type === "table") {
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <circle
          cx={obj.center.x}
          cy={obj.center.y}
          r={obj.radius}
          fill={catColor}
          fillOpacity={0.35}
          stroke={stroke}
          strokeWidth={sw}
        />
        <text
          x={obj.center.x}
          y={obj.center.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#333"
          className="pointer-events-none"
        >
          {obj.label}
        </text>
        {obj.seats.map((seat) => (
          <SeatDot
            key={seat.id}
            seat={seat}
            color={categoryColor(chart.categories, seat.categoryKey ?? obj.categoryKey)}
            selected={selectedSeatIds.includes(seat.id) || selected}
            showLabel={showLabels}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSeat(seat.id, e.shiftKey || e.metaKey);
            }}
          />
        ))}
      </g>,
    );
  }

  if (obj.type === "booth" || obj.type === "rectangle") {
    const isStage = obj.type === "rectangle" && (obj.label === "무대" || obj.label === "STAGE");
    const showRectLabel = showLabels || selected || isStage || obj.type === "booth";
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <rect
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          rx={obj.type === "booth" ? 4 : 6}
          fill={obj.type === "rectangle" ? (obj.fill ?? "#9ca3af") : catColor}
          fillOpacity={obj.type === "booth" ? 0.45 : 0.9}
          stroke={stroke}
          strokeWidth={sw}
        />
        {showRectLabel && (
          <text
            x={obj.x + obj.width / 2}
            y={obj.y + obj.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={isStage ? 14 : 12}
            fontWeight={700}
            fill={isStage || (obj.type === "rectangle" && obj.fill === "#6b7280") ? "#fff" : "#333"}
            className="pointer-events-none"
          >
            {isStage ? `⌂ ${obj.label}` : obj.label}
          </text>
        )}
      </g>,
    );
  }

  if (obj.type === "area") {
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <path
          d={polygonPath(obj.points)}
          fill={catColor}
          fillOpacity={0.3}
          stroke={stroke}
          strokeWidth={sw}
          strokeDasharray="6 3"
        />
        <text
          x={objectCenter(obj).x}
          y={objectCenter(obj).y}
          textAnchor="middle"
          fontSize={12}
          fill="#333"
          className="pointer-events-none"
        >
          {obj.label} ({obj.capacity})
        </text>
      </g>,
    );
  }

  if (obj.type === "line") {
    return wrap(
      <line
        x1={obj.start.x}
        y1={obj.start.y}
        x2={obj.end.x}
        y2={obj.end.y}
        stroke={selected ? "#0784fa" : obj.stroke ?? "#666"}
        strokeWidth={selected ? 3 : 2}
        onPointerDown={handlePointerDown}
        onClick={handle}
        className="cursor-pointer"
      />,
    );
  }

  if (obj.type === "text") {
    return wrap(
      <text
        x={obj.position.x}
        y={obj.position.y}
        textAnchor="middle"
        fontSize={obj.fontSize ?? 14}
        fill={selected ? "#0784fa" : obj.color ?? "#333"}
        fontWeight={600}
        onPointerDown={handlePointerDown}
        onClick={handle}
        className="cursor-pointer select-none"
      >
        {obj.text}
      </text>,
    );
  }

  if (obj.type === "image") {
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        {obj.href ? (
          <image href={obj.href} x={obj.x} y={obj.y} width={obj.width} height={obj.height} opacity={obj.opacity ?? 1} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill="#e2e8f0"
            stroke={stroke}
            strokeWidth={sw}
            strokeDasharray="4 2"
          />
        )}
        <rect
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          fill="transparent"
          stroke={stroke}
          strokeWidth={sw}
        />
        {!obj.href && (
          <text
            x={obj.x + obj.width / 2}
            y={obj.y + obj.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="#64748b"
          >
            {ko.imagePlaceholder}
          </text>
        )}
      </g>,
    );
  }

  if (obj.type === "icon") {
    const glyph =
      obj.icon === "stage" ? "⌂" : obj.icon === "star" ? "★" : obj.icon === "entrance" ? "↗" : "WC";
    return wrap(
      <g onPointerDown={handlePointerDown} onClick={handle} className="cursor-pointer">
        <circle
          cx={obj.position.x}
          cy={obj.position.y}
          r={(obj.size ?? 16) / 2 + 2}
          fill={selected ? "#0784fa" : "#333"}
        />
        <text
          x={obj.position.x}
          y={obj.position.y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={obj.icon === "wc" ? 8 : 10}
          fill="#fff"
          className="pointer-events-none"
        >
          {glyph}
        </text>
      </g>,
    );
  }

  return null;
}

export function DesignerCanvas({ api }: { readonly api: SeatEditorApi }) {
  const {
    state,
    dispatch,
    dragRef,
    screenToWorld,
    placeObjectAt,
    finishPolygon,
    finishRectangle,
    commitTranslate,
    commitNodeMove,
    commitRowEndpoints,
    addPolygonNode,
    removePolygonNode,
  } = api;
  const { chart, viewport, settings, tool, selectedIds, selectedSeatIds, draftPoints, status, fitGeneration } =
    state;
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastFitGenRef = useRef(0);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [liveNode, setLiveNode] = useState<{ objectId: string; index: number; point: { x: number; y: number } } | null>(
    null,
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.code === "Space" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") setSpacePan(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Center & fit chart when canvas size is known or a new chart is loaded
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const applyFit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 40 || height < 40) return false;
      const next = fitViewportToChart(chart, width, height, 56);
      dispatch({ type: "SET_VIEWPORT", viewport: next });
      lastFitGenRef.current = fitGeneration;
      return true;
    };

    if (lastFitGenRef.current !== fitGeneration) {
      applyFit();
    }

    const ro = new ResizeObserver(() => {
      // First time we get a real size for this generation, fit again
      if (lastFitGenRef.current !== fitGeneration) applyFit();
    });
    ro.observe(el);
    // Also try next frame (layout after flex settle)
    const raf = requestAnimationFrame(() => {
      if (lastFitGenRef.current !== fitGeneration) applyFit();
    });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [chart, dispatch, fitGeneration]);

  const layerOk = useCallback(
    (obj: ChartObject) => {
      if (settings.selectionLayer === "all") return true;
      return obj.layer === settings.selectionLayer;
    },
    [settings.selectionLayer],
  );

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.altKey || e.metaKey || e.ctrlKey)) {
      // natural pan with wheel
      dispatch({
        type: "SET_VIEWPORT",
        viewport: {
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        },
      });
      return;
    }
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(4, Math.max(0.15, viewport.zoom * factor));
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // zoom toward cursor
    const wx = (sx - viewport.x) / viewport.zoom;
    const wy = (sy - viewport.y) / viewport.zoom;
    dispatch({
      type: "SET_VIEWPORT",
      viewport: {
        zoom: nextZoom,
        x: sx - wx * nextZoom,
        y: sy - wy * nextZoom,
      },
    });
  };

  const beginMove = (id: string, e: ReactPointerEvent) => {
    const object = chart.objects.find((candidate) => candidate.id === id);
    if (!object || !layerOk(object)) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect);

    if (tool === "selectSame") {
      dispatch({ type: "SELECT", ids: [...sameTypeSelection(chart, id)] });
      return;
    }

    if (tool === "selectSeats" || tool === "brush") return;

    if (tool === "select" || tool === "node") {
      const additive = e.shiftKey || e.metaKey;
      const already = selectedIds.includes(id);
      if (!already) dispatch({ type: "SELECT", ids: [id], additive });
      else if (additive) dispatch({ type: "SELECT", ids: [id], additive: true });

      if (tool === "select") {
        dragRef.current = {
          mode: "move",
          startScreen: { x: e.clientX, y: e.clientY },
          startWorld: world,
          originViewport: { ...viewport },
          moved: false,
        };
        setDragOffset({ x: 0, y: 0 });
      }
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const world = screenToWorld(e.clientX, e.clientY, rect);
    const isHand = tool === "hand" || e.button === 1 || spacePan;

    if (isHand) {
      dragRef.current = {
        mode: "pan",
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: world,
        originViewport: { ...viewport },
      };
      return;
    }

    if (tool === "rectangle" || tool === "booth") {
      dragRef.current = {
        mode: "draw",
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: world,
        originViewport: { ...viewport },
      };
      return;
    }

    if (tool === "select") {
      dragRef.current = {
        mode: "marquee",
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: world,
        originViewport: { ...viewport },
      };
      setMarquee({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
      if (!e.shiftKey) dispatch({ type: "CLEAR_SELECTION" });
      return;
    }

    if (tool === "brush" || tool === "selectSeats") {
      dragRef.current = {
        mode: "brush",
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: world,
        originViewport: { ...viewport },
      };
      // also pick seat under cursor immediately
      const hit: string[] = [];
      for (const obj of chart.objects) {
        const seats =
          obj.type === "row"
            ? obj.seats
            : obj.type === "table"
              ? obj.seats
              : obj.type === "section"
                ? obj.nestedRows?.flatMap((r) => r.seats) ?? []
                : [];
        for (const s of seats) {
          if (Math.hypot(s.x - world.x, s.y - world.y) < 12) hit.push(s.id);
        }
      }
      if (hit.length) dispatch({ type: "SELECT_SEATS", ids: hit, additive: e.shiftKey, remove: e.altKey });
      return;
    }

    if (["row", "section", "area", "line", "table", "text", "image", "icon", "focal"].includes(tool)) {
      placeObjectAt(world);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect);

    if (drag.mode === "pan") {
      const dx = e.clientX - drag.startScreen.x;
      const dy = e.clientY - drag.startScreen.y;
      dispatch({
        type: "SET_VIEWPORT",
        viewport: {
          x: drag.originViewport.x + dx,
          y: drag.originViewport.y + dy,
        },
      });
      return;
    }

    if (drag.mode === "move") {
      setDragOffset({
        x: world.x - drag.startWorld.x,
        y: world.y - drag.startWorld.y,
      });
      drag.moved = true;
      return;
    }

    if (drag.mode === "node" && drag.nodeObjectId != null && drag.nodeIndex != null) {
      setLiveNode({ objectId: drag.nodeObjectId, index: drag.nodeIndex, point: world });
      drag.moved = true;
      return;
    }

    if (drag.mode === "row-end" && drag.nodeObjectId && drag.rowEnd) {
      setLiveNode({
        objectId: drag.nodeObjectId,
        index: drag.rowEnd === "start" ? 0 : 1,
        point: world,
      });
      drag.moved = true;
      return;
    }

    if (drag.mode === "marquee") {
      setMarquee({
        x0: drag.startWorld.x,
        y0: drag.startWorld.y,
        x1: world.x,
        y1: world.y,
      });
      return;
    }

    if (drag.mode === "draw") {
      setMarquee({
        x0: drag.startWorld.x,
        y0: drag.startWorld.y,
        x1: world.x,
        y1: world.y,
      });
      return;
    }

    if (drag.mode === "brush") {
      const hit: string[] = [];
      for (const obj of chart.objects) {
        if (obj.floorId && obj.floorId !== chart.activeFloorId) continue;
        const seats =
          obj.type === "row"
            ? obj.seats
            : obj.type === "table"
              ? obj.seats
              : obj.type === "section"
                ? obj.nestedRows?.flatMap((r) => r.seats) ?? []
                : [];
        for (const s of seats) {
          if (Math.hypot(s.x - world.x, s.y - world.y) < 12) hit.push(s.id);
        }
      }
      if (hit.length) dispatch({ type: "SELECT_SEATS", ids: hit, additive: true, remove: e.altKey });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.mode === "move" && dragOffset) {
      if (Math.hypot(dragOffset.x, dragOffset.y) > 1) {
        commitTranslate(selectedIds, dragOffset.x, dragOffset.y);
      }
      setDragOffset(null);
    }
    if (drag?.mode === "node" && liveNode) {
      commitNodeMove(liveNode.objectId, liveNode.index, liveNode.point);
      setLiveNode(null);
    }
    if (drag?.mode === "row-end" && liveNode && drag.rowEnd) {
      const obj = chart.objects.find((o) => o.id === liveNode.objectId);
      if (obj && obj.type === "row") {
        const start = drag.rowEnd === "start" ? liveNode.point : obj.start;
        const end = drag.rowEnd === "end" ? liveNode.point : obj.end;
        commitRowEndpoints(obj.id, start, end);
      }
      setLiveNode(null);
    }
    if (drag?.mode === "marquee" && marquee) {
      const minX = Math.min(marquee.x0, marquee.x1);
      const maxX = Math.max(marquee.x0, marquee.x1);
      const minY = Math.min(marquee.y0, marquee.y1);
      const maxY = Math.max(marquee.y0, marquee.y1);
      if (maxX - minX > 4 || maxY - minY > 4) {
        const ids = marqueeObjectSelection(
          chart,
          { x: marquee.x0, y: marquee.y0 },
          { x: marquee.x1, y: marquee.y1 },
          settings.selectionLayer,
        );
        dispatch({ type: "SELECT", ids: [...ids], additive: e.shiftKey });
      }
    }
    if (drag?.mode === "draw" && marquee) {
      finishRectangle(
        { x: marquee.x0, y: marquee.y0 },
        { x: marquee.x1, y: marquee.y1 },
      );
    }
    dragRef.current = null;
    setMarquee(null);
  };

  const onDoubleClick = () => {
    if (tool === "section" || tool === "area") finishPolygon();
  };

  const onObjectSelect = (id: string, additive: boolean) => {
    const object = chart.objects.find((candidate) => candidate.id === id);
    if (!object || !layerOk(object)) return;
    if (tool === "selectSame") {
      dispatch({ type: "SELECT", ids: [...sameTypeSelection(chart, id)] });
      return;
    }
    if (tool === "select" || tool === "node") {
      if (chart.objects.find((object) => object.id === id)?.locked) return;
      dispatch({ type: "SELECT", ids: [id], additive });
    }
  };

  const bg = settings.darkCanvas ? "#1a1d24" : "#ffffff";
  const places = countPlaces(chart);
  const floorObjects = chart.objects.filter(
    (o) => !o.floorId || o.floorId === chart.activeFloorId,
  );
  const nodeTargets = floorObjects.filter(
    (o) =>
      selectedIds.includes(o.id) &&
      (tool === "node" || tool === "select") &&
      (o.type === "section" || o.type === "area" || o.type === "row"),
  );
  const backgroundOverlay = settings.showBackgroundImage ? normalizeOverlay(chart.backgroundImage) : undefined;
  const referenceOverlay = settings.showReferenceChart ? chart.referenceChart : undefined;

  return (
    <div
      ref={wrapRef}
      data-testid="designer-canvas"
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden",
        tool === "hand" || spacePan ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
      )}
      style={{ background: bg }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.code === "Space") setSpacePan(true);
      }}
      onKeyUp={(e) => {
        if (e.code === "Space") setSpacePan(false);
      }}
    >
      <svg className="h-full w-full touch-none" xmlns="http://www.w3.org/2000/svg">
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {settings.snapToGrid && (
            <defs>
              <pattern id="grid" width={settings.gridSize * 4} height={settings.gridSize * 4} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${settings.gridSize * 4} 0 L 0 0 0 ${settings.gridSize * 4}`}
                  fill="none"
                  stroke={settings.darkCanvas ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}
                  strokeWidth="1"
                />
              </pattern>
            </defs>
          )}
          {settings.snapToGrid && <rect x={-2000} y={-2000} width={6000} height={6000} fill="url(#grid)" />}

          {backgroundOverlay && (
            <image
              href={backgroundOverlay.href}
              x={backgroundOverlay.x}
              y={backgroundOverlay.y}
              width={backgroundOverlay.width}
              height={backgroundOverlay.height}
              opacity={backgroundOverlay.opacity}
              preserveAspectRatio="none"
              className="pointer-events-none"
            />
          )}
          {referenceOverlay && (
            <image
              href={referenceOverlay.href}
              x={referenceOverlay.x}
              y={referenceOverlay.y}
              width={referenceOverlay.width}
              height={referenceOverlay.height}
              opacity={referenceOverlay.opacity}
              preserveAspectRatio="none"
              className="pointer-events-none"
            />
          )}

          {(["background", "surroundings", "interactive", "foreground"] as const).flatMap((layer) =>
            floorObjects
              .filter((o) => o.layer === layer)
              .map((obj) => (
                <g key={obj.id} data-object-id={obj.id} data-object-type={obj.type}>
                  <ObjectView
                    obj={obj}
                    chart={chart}
                    selected={selectedIds.includes(obj.id)}
                    selectedSeatIds={selectedSeatIds}
                    showContents={settings.showSectionContents}
                    showLabels={settings.alwaysShowLabels}
                    dragOffset={selectedIds.includes(obj.id) ? dragOffset : null}
                    onSelect={onObjectSelect}
                    onSelectSeat={(sid, add) => dispatch({ type: "SELECT_SEATS", ids: [sid], additive: add })}
                    onBeginMove={beginMove}
                  />
                </g>
              )),
          )}

          {/* Node / row endpoint handles */}
          {nodeTargets.map((obj) => {
            if (obj.type === "section" || obj.type === "area") {
              return (
                <g key={`${obj.id}-nodes`}>
                  <polyline
                    points={[...obj.points, obj.points[0]].map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    className="cursor-copy"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      const rect = wrapRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const point = screenToWorld(event.clientX, event.clientY, rect);
                      let closestIndex = 0;
                      let closestDistance = Infinity;
                      for (let index = 0; index < obj.points.length; index += 1) {
                        const first = obj.points[index];
                        const second = obj.points[(index + 1) % obj.points.length];
                        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
                        const distance = Math.hypot(midpoint.x - point.x, midpoint.y - point.y);
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestIndex = index;
                        }
                      }
                      addPolygonNode(obj.id, closestIndex + 1, point);
                    }}
                  />
                  {obj.points.map((p, index) => {
                    const pt = liveNode && liveNode.objectId === obj.id && liveNode.index === index ? liveNode.point : p;
                    return (
                      <circle
                        key={`${obj.id}-n-${index}`}
                        data-testid="node-handle"
                        cx={pt.x}
                        cy={pt.y}
                        r={6}
                        fill="#fff"
                        stroke="#0784fa"
                        strokeWidth={2}
                        className="cursor-move"
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          removePolygonNode(obj.id, index);
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const rect = wrapRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const world = screenToWorld(e.clientX, e.clientY, rect);
                          dragRef.current = {
                            mode: "node",
                            startScreen: { x: e.clientX, y: e.clientY },
                            startWorld: world,
                            originViewport: { ...viewport },
                            nodeObjectId: obj.id,
                            nodeIndex: index,
                          };
                          setLiveNode({ objectId: obj.id, index, point: world });
                        }}
                      />
                    );
                  })}
                </g>
              );
            }
            if (obj.type === "row") {
              const ends = [
                { key: "start" as const, p: obj.start },
                { key: "end" as const, p: obj.end },
              ];
              return ends.map(({ key, p }, index) => {
                const pt =
                  liveNode && liveNode.objectId === obj.id && liveNode.index === index ? liveNode.point : p;
                return (
                  <circle
                    key={`${obj.id}-${key}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill="#fff"
                    stroke="#0784fa"
                    strokeWidth={2}
                    className="cursor-move"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const rect = wrapRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const world = screenToWorld(e.clientX, e.clientY, rect);
                      dragRef.current = {
                        mode: "row-end",
                        startScreen: { x: e.clientX, y: e.clientY },
                        startWorld: world,
                        originViewport: { ...viewport },
                        nodeObjectId: obj.id,
                        rowEnd: key,
                      };
                      setLiveNode({ objectId: obj.id, index, point: world });
                    }}
                  />
                );
              });
            }
            return null;
          })}

          {chart.focalPoint && (
            <g data-testid="chart-focal-point">
              <circle cx={chart.focalPoint.x} cy={chart.focalPoint.y} r={8} fill="none" stroke="#0784fa" strokeWidth={2} />
              <circle cx={chart.focalPoint.x} cy={chart.focalPoint.y} r={2.5} fill="#0784fa" />
            </g>
          )}

          {draftPoints.length > 0 && (
            <g>
              {draftPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill="#0784fa" />
              ))}
              {draftPoints.length > 1 && (
                <polyline
                  points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#0784fa"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
            </g>
          )}

          {marquee && (
            <rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(7,132,250,0.12)"
              stroke="#0784fa"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
        </g>
      </svg>

      {/* Navigation HUD */}
      <div className="absolute bottom-14 left-3 flex flex-col items-center gap-1">
        <div className="relative size-[60px] rounded-full border border-black/10 bg-white/90 shadow-sm">
          <div className="absolute inset-0 m-auto size-2 rounded-full bg-[#0784fa]" />
          {(
            [
              { label: "N", dx: 0, dy: -1, transform: "translateX(-50%)" },
              { label: "E", dx: 1, dy: 0, transform: "translateY(-50%)" },
              { label: "S", dx: 0, dy: 1, transform: "translateX(-50%)" },
              { label: "W", dx: -1, dy: 0, transform: "translateY(-50%)" },
            ] as const
          ).map(({ label, dx, dy, transform }) => (
            <button
              key={label}
              type="button"
              className="absolute flex size-5 items-center justify-center text-[10px] text-[#666] hover:text-[#0784fa]"
              style={{
                left: dx === 0 ? "50%" : dx > 0 ? "auto" : 2,
                right: dx > 0 ? 2 : "auto",
                top: dy === 0 ? "50%" : dy < 0 ? 2 : "auto",
                bottom: dy > 0 ? 2 : "auto",
                transform,
              }}
              onClick={() =>
                dispatch({
                  type: "SET_VIEWPORT",
                  viewport: { x: viewport.x - dx * 80, y: viewport.y - dy * 80 },
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="size-7 rounded border border-black/10 bg-white text-sm shadow-sm"
            onClick={() => dispatch({ type: "SET_VIEWPORT", viewport: { zoom: Math.max(0.15, viewport.zoom * 0.85) } })}
          >
            −
          </button>
          <button
            type="button"
            className="size-7 rounded border border-black/10 bg-white text-sm shadow-sm"
            onClick={() => dispatch({ type: "SET_VIEWPORT", viewport: { zoom: Math.min(4, viewport.zoom * 1.15) } })}
          >
            +
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[12px] text-[#666]">
        <span>
          <strong className="font-semibold text-[#333]">{toolLabel(tool)}</strong>
          <span className="mx-2 text-black/20">|</span>
          {status}
        </span>
        <span className="rounded bg-white/80 px-2 py-0.5 tabular-nums shadow-sm">
          {places.toLocaleString("ko-KR")} {ko.places}
        </span>
      </div>
    </div>
  );
}
