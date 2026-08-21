import type { ChartObject, Point } from "@/types/seat-chart";
import { renderCanvasObject } from "./canvas-object-renderer";
import { CanvasNodeHandles } from "./canvas-node-handles";
import { SelectionBox } from "./canvas-primitives";

type CanvasObjectsProps = {
  readonly objects: readonly ChartObject[];
  readonly selectedIds: readonly string[];
  readonly selectedSeatIds: readonly string[];
  readonly nodeMode: boolean;
  readonly showLabels?: boolean;
  readonly hideNodeInsertHandles?: boolean;
  readonly onInsertNode?: (objectId: string, afterIndex: number, point: Point) => void;
};

export function CanvasObjects({ objects, selectedIds, selectedSeatIds, nodeMode, showLabels = true, hideNodeInsertHandles = false, onInsertNode }: CanvasObjectsProps) {
  return (
    <>
      {objects.map((object) => {
        const selected = selectedIds.includes(object.id);
        return (
          <g key={object.id} data-object-id={object.id} data-object-type={object.type}>
            {renderCanvasObject(object, selectedSeatIds, showLabels)}
            {selected && !object.locked && <SelectionBox object={object} />}
            {nodeMode && selected && <CanvasNodeHandles object={object} hidden={hideNodeInsertHandles} onInsert={onInsertNode} />}
          </g>
        );
      })}
    </>
  );
}
