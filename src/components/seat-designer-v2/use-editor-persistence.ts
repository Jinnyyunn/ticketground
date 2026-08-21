import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { apiPublishChart, apiSaveChart, apiUploadReferenceAsset } from "@/lib/seat-charts/client";
import type { ImageObject } from "@/types/seat-chart";
import { chartDocument } from "./object-factory";
import { fitReferenceAsset } from "./reference-layout";
import type { V2EditorState, V2Point } from "./editor-model";

type PersistenceDeps = {
  readonly state: V2EditorState;
  readonly setState: Dispatch<SetStateAction<V2EditorState>>;
  readonly stateRef: MutableRefObject<V2EditorState>;
  readonly referenceRequest: MutableRefObject<number>;
  readonly imagePoint: V2Point | null;
  readonly setImagePoint: Dispatch<SetStateAction<V2Point | null>>;
  readonly setPendingUploads: Dispatch<SetStateAction<number>>;
  readonly commitCurrent: (update: (current: V2EditorState) => V2EditorState) => void;
};

export function useEditorPersistence(deps: PersistenceDeps) {
  const { state, setState } = deps;
  async function uploadObject(file: File): Promise<void> {
    const targetPoint = deps.imagePoint ?? { x: 320, y: 220 };
    deps.setPendingUploads((count) => count + 1);
    setState((current) => ({ ...current, status: "이미지 불러오는 중…" }));
    try {
      const uploaded = await apiUploadReferenceAsset({ file, purpose: "object" });
      const fitted = fitReferenceAsset(uploaded.asset, { width: 240, height: 180 }, targetPoint);
      const object: ImageObject = { id: `image_${crypto.randomUUID()}`, label: "이미지", layer: "background", type: "image", ...fitted, href: uploaded.url, opacity: 1, aspectRatioLocked: true };
      deps.commitCurrent((current) => ({ ...current, objects: [...current.objects, { ...object, floorId: current.activeFloorId, sectionId: current.activeSectionId ?? undefined }], assets: [...current.assets, uploaded.asset], selectedIds: [object.id] }));
    } catch {
      setState((current) => ({ ...current, status: "이미지를 불러오지 못했습니다" }));
    } finally {
      deps.setImagePoint(null);
      deps.setPendingUploads((count) => Math.max(0, count - 1));
    }
  }
  async function replaceReference(file: File): Promise<void> {
    const request = deps.referenceRequest.current + 1;
    deps.referenceRequest.current = request;
    deps.setPendingUploads((count) => count + 1);
    setState((current) => ({ ...current, status: "참조 도면 교체 중…" }));
    try {
      const uploaded = await apiUploadReferenceAsset({ file, purpose: "reference" });
      if (request !== deps.referenceRequest.current) return;
      setState((current) => {
        const next = {
          ...current,
          referencePlan: current.referencePlan ? { ...current.referencePlan, asset: uploaded.asset, href: uploaded.url, name: file.name, ...fitReferenceAsset(uploaded.asset, { width: current.referencePlan.width, height: current.referencePlan.height }, { x: current.referencePlan.x, y: current.referencePlan.y }) } : null,
          assets: current.referencePlan ? [...current.assets.filter((asset) => asset.kind !== "reference"), uploaded.asset] : current.assets,
          status: current.referencePlan ? "참조 도면 교체됨" : current.status,
        };
        deps.stateRef.current = next;
        return next;
      });
    } catch {
      setState((current) => ({ ...current, status: "참조 도면을 교체하지 못했습니다" }));
    } finally {
      deps.setPendingUploads((count) => Math.max(0, count - 1));
    }
  }
  function removeReference(): void {
    deps.referenceRequest.current += 1;
    setState((current) => {
      const next = { ...current, referencePlan: null, assets: current.assets.filter((asset) => asset.kind !== "reference"), status: "참조 도면 제거됨" };
      deps.stateRef.current = next;
      return next;
    });
  }
  async function save(): Promise<void> {
    if (!state.venue) return;
    setState((current) => ({ ...current, status: "저장 중…" }));
    try {
      await apiSaveChart(chartDocument(state), state.venue);
      setState((current) => ({ ...current, status: "초안 저장 완료" }));
    } catch (cause) {
      setState((current) => ({ ...current, status: cause instanceof Error ? "저장 실패" : "저장할 수 없음" }));
    }
  }
  async function publish(): Promise<void> {
    if (!state.venue) return;
    setState((current) => ({ ...current, status: "게시 중…" }));
    try {
      const saved = await apiSaveChart(chartDocument(state), state.venue);
      await apiPublishChart(saved.id, true, state.venue);
      setState((current) => ({ ...current, status: "게시 완료" }));
    } catch (cause) {
      setState((current) => ({ ...current, status: cause instanceof Error ? "게시 실패" : "게시할 수 없음" }));
    }
  }
  return { uploadObject, replaceReference, removeReference, save, publish };
}
