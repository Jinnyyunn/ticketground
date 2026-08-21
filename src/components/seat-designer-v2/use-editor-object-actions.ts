import type { ChartObject, SeatPlace } from "@/types/seat-chart";
import type { V2EditorState } from "./editor-model";

export function useEditorObjectActions(state: V2EditorState, commit: (next: V2EditorState) => void) {
  function updateObject(next: ChartObject): void {
    commit({ ...state, objects: state.objects.map((object) => object.id === next.id ? next : object) });
  }
  function updateSeat(next: SeatPlace): void {
    commit({
      ...state,
      objects: state.objects.map((object) => object.type === "row" || object.type === "table" ? { ...object, seats: object.seats.map((seat) => seat.id === next.id ? next : seat) } : object),
    });
  }
  return { updateObject, updateSeat };
}
