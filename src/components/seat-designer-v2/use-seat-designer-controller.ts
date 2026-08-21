import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ChartObject, RowObject, SeatPlace } from "@/types/seat-chart";
import { INITIAL_STATE, type V2EditorState, type V2Point } from "./editor-model";
import { previewObject, visibleObjects } from "./interaction-helpers";
import { insertPathNode } from "./node-geometry";
import { buildMultipleRows } from "./row-geometry";
import type { SmartGuide } from "./smart-guides";
import { useEditorHistory } from "./use-editor-history";
import { useEditorKeyboard } from "./use-editor-keyboard";
import { useEditorObjectActions } from "./use-editor-object-actions";
import { useEditorPersistence } from "./use-editor-persistence";
import { useEditorPointer } from "./use-editor-pointer";

export function useSeatDesignerController(imageInput: RefObject<HTMLInputElement | null>) {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<V2EditorState>(INITIAL_STATE);
  const [past, setPast] = useState<readonly V2EditorState[]>([]);
  const [future, setFuture] = useState<readonly V2EditorState[]>([]);
  const [shift, setShift] = useState(false);
  const [preview, setPreview] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [seatViewOpen, setSeatViewOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [imagePoint, setImagePoint] = useState<V2Point | null>(null);
  const [multipleBase, setMultipleBase] = useState<RowObject | null>(null);
  const [smartGuides, setSmartGuides] = useState<readonly SmartGuide[]>([]);
  const [altPressed, setAltPressed] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [copiedObjects, setCopiedObjects] = useState<readonly ChartObject[]>([]);
  const stateRef = useRef(state);
  const referenceRequest = useRef(0);
  useEffect(() => { stateRef.current = state; }, [state]);

  const visible = useMemo(() => visibleObjects(state), [state]);
  const draftPreview = useMemo(() => previewObject(state, shift), [shift, state]);
  const multiplePreview = useMemo(() => multipleBase && state.draft ? buildMultipleRows(multipleBase, state.draft.current, state.rowSpacing, state.multipleRowLayout) : null, [multipleBase, state.draft, state.multipleRowLayout, state.rowSpacing]);
  const previewObjects = multiplePreview ?? (draftPreview ? [draftPreview] : []);
  const selectedSeat = useMemo<SeatPlace | null>(() => {
    for (const object of state.objects) {
      if (object.type !== "row" && object.type !== "table") continue;
      const seat = object.seats.find((candidate) => state.selectedSeatIds.includes(candidate.id));
      if (seat) return seat;
    }
    return null;
  }, [state.objects, state.selectedSeatIds]);

  const history = useEditorHistory({ state, setState, past, setPast, future, setFuture, stateRef, copiedObjects, setCopiedObjects, setStarted, setMultipleBase, setSmartGuides });
  const objects = useEditorObjectActions(state, history.commit);
  const persistence = useEditorPersistence({ state, setState, stateRef, referenceRequest, imagePoint, setImagePoint, setPendingUploads, commitCurrent: history.commitCurrent });
  const pointer = useEditorPointer({ state, setState, visibleObjects: visible, spacePressed, setShift, setAltPressed, setSmartGuides, imageInput, setImagePoint, multipleBase, setMultipleBase, multiplePreview, setPast, setFuture, commit: history.commit, updateObject: objects.updateObject });
  useEditorKeyboard({ setAltPressed, setSpacePressed, setMultipleBase, setSmartGuides, setState, undo: history.undo, redo: history.redo, copy: history.copySelected, paste: history.pasteCopied, remove: history.deleteSelected, finishPath: pointer.finishPath, selectTool: history.selectTool });

  function insertNode(objectId: string, afterIndex: number, point: V2Point): void {
    const target = state.objects.find((object) => object.id === objectId);
    if (!target || !("points" in target) || !target.points) return;
    objects.updateObject({ ...target, points: insertPathNode(target.points, afterIndex, point) });
  }
  function openSeatView(): void { setInspectorOpen(false); setSeatViewOpen(true); }
  function openCredentials(): void { setInspectorOpen(false); setCredentialsOpen(true); }
  function openHelp(): void { setInspectorOpen(false); setHelpOpen(true); }

  return {
    started, state, setState, past, future, preview, setPreview, credentialsOpen, setCredentialsOpen,
    helpOpen, setHelpOpen, seatViewOpen, setSeatViewOpen, inspectorOpen, setInspectorOpen,
    pendingUploads, copiedObjects, smartGuides, altPressed, spacePressed,
    visibleObjects: visible, previewObjects, selectedSeat, insertNode, openSeatView, openCredentials, openHelp,
    ...history, ...objects, ...persistence, ...pointer,
  };
}
