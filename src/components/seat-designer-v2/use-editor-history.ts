import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChartObject } from "@/types/seat-chart";
import type { V2EditorState, V2ReferencePlan } from "./editor-model";
import { alignObjects, distributeObjects, duplicateObject, flipObjects, type AlignmentMode, type DistributionMode, type FlipAxis } from "./object-transform";
import type { SmartGuide } from "./smart-guides";
import { toolSpec, type V2ToolId } from "./tool-catalog";

type HistoryDeps = {
  readonly state: V2EditorState;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly past: readonly V2EditorState[];
  readonly setPast: Dispatch<SetStateAction<readonly V2EditorState[]>>;
  readonly future: readonly V2EditorState[];
  readonly setFuture: Dispatch<SetStateAction<readonly V2EditorState[]>>;
  readonly stateRef: MutableRefObject<V2EditorState>;
  readonly copiedObjects: readonly ChartObject[];
  readonly setCopiedObjects: Dispatch<SetStateAction<readonly ChartObject[]>>;
  readonly setStarted: Dispatch<SetStateAction<boolean>>;
  readonly setMultipleBase: Dispatch<SetStateAction<import("@/types/seat-chart").RowObject | null>>;
  readonly setSmartGuides: Dispatch<SetStateAction<readonly SmartGuide[]>>;
};

export function useEditorHistory(deps: HistoryDeps) {
  const { state, setState } = deps;
  function commit(next: V2EditorState): void {
    deps.setPast((items) => [...items, { ...state, draft: null }]);
    deps.setFuture([]);
    const committed = { ...next, draft: null, status: "저장되지 않은 변경" };
    deps.stateRef.current = committed;
    setState(committed);
  }
  function commitCurrent(update: (current: V2EditorState) => V2EditorState): void {
    const current = deps.stateRef.current;
    const committed = { ...update(current), draft: null, status: "저장되지 않은 변경" };
    deps.setPast((items) => [...items, { ...current, draft: null }]);
    deps.setFuture([]);
    deps.stateRef.current = committed;
    setState(committed);
  }
  function selectTool(tool: V2ToolId): void {
    deps.setMultipleBase(null);
    deps.setSmartGuides([]);
    setState((current) => ({ ...current, tool, draft: null, status: `${toolSpec(tool).label} 도구` }));
  }
  function start(plan: V2ReferencePlan | null, venue: NonNullable<V2EditorState["venue"]>): void {
    setState((current) => ({ ...current, venue, referencePlan: plan, assets: plan ? [plan.asset] : [], status: "편집 준비됨" }));
    deps.setStarted(true);
  }
  function undo(): void {
    const previous = deps.past.at(-1);
    if (!previous) return;
    deps.setFuture((items) => [{ ...state, draft: null }, ...items]);
    deps.setPast((items) => items.slice(0, -1));
    setState(previous);
  }
  function redo(): void {
    const next = deps.future[0];
    if (!next) return;
    deps.setPast((items) => [...items, { ...state, draft: null }]);
    deps.setFuture((items) => items.slice(1));
    setState(next);
  }
  function deleteSelected(): void {
    if (!state.selectedIds.length) return;
    commit({ ...state, objects: state.objects.filter((object) => !state.selectedIds.includes(object.id) || object.locked === true), selectedIds: [] });
  }
  function duplicateSelected(): void {
    const copies = state.objects.filter((object) => state.selectedIds.includes(object.id) && object.locked !== true).map((object) => duplicateObject(object));
    if (copies.length) commit({ ...state, objects: [...state.objects, ...copies], selectedIds: copies.map((object) => object.id) });
  }
  function copySelected(): void {
    const copied = state.objects.filter((object) => state.selectedIds.includes(object.id) && object.locked !== true);
    deps.setCopiedObjects(copied);
    setState((current) => ({ ...current, status: copied.length ? `${copied.length}개 객체 복사됨` : "복사할 객체를 선택하세요" }));
  }
  function pasteCopied(): void {
    const copies = deps.copiedObjects.map((object) => duplicateObject(object));
    if (copies.length) commit({ ...state, objects: [...state.objects, ...copies], selectedIds: copies.map((object) => object.id) });
  }
  function alignSelected(mode: AlignmentMode): void {
    if (state.selectedIds.length >= 2) commit({ ...state, objects: alignObjects(state.objects, state.selectedIds, mode) });
  }
  function distributeSelected(mode: DistributionMode): void {
    if (state.selectedIds.length >= 3) commit({ ...state, objects: distributeObjects(state.objects, state.selectedIds, mode) });
  }
  function flipSelected(axis: FlipAxis): void {
    if (state.selectedIds.length) commit({ ...state, objects: flipObjects(state.objects, state.selectedIds, axis) });
  }
  return { commit, commitCurrent, selectTool, start, undo, redo, deleteSelected, duplicateSelected, copySelected, pasteCopied, alignSelected, distributeSelected, flipSelected };
}
