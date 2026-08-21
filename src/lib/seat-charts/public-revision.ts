import type { SeatChartAsset, SeatChartDocumentV2 } from "../../types/seat-chart.ts";
import type { PublishedVenueRevision } from "./revisions.ts";

export type PublicSeatChartDocument = Omit<SeatChartDocumentV2, "draftRevision" | "assets"> & {
  readonly assets: readonly Pick<SeatChartAsset, "id" | "kind" | "mediaType" | "width" | "height" | "page" | "contentHash">[];
};

export type PublicSeatChartRevision = {
  readonly chartKey: string;
  readonly revisionId: string;
  readonly venueId: string;
  readonly publishedAt: string;
  readonly contentHash: string;
  readonly document: PublicSeatChartDocument;
};

export function publicSeatChartDocument(document: SeatChartDocumentV2): PublicSeatChartDocument {
  const { id, name, categories, objects, floors, activeFloorId, focalPoint, backgroundImage, referenceChart, version, chartKey, venueId, venueName, venueType, zones, assets } = document;
  return {
      id,
      name,
      categories,
      objects,
      floors,
      activeFloorId,
      ...(focalPoint ? { focalPoint } : {}),
      ...(backgroundImage ? { backgroundImage } : {}),
      ...(referenceChart ? { referenceChart } : {}),
      version,
      chartKey,
      venueId,
      ...(venueName ? { venueName } : {}),
      venueType,
      zones,
      assets: assets.map(({ id, kind, mediaType, width, height, page, contentHash }) => ({
        id,
        kind,
        mediaType,
        width,
        height,
        ...(page === undefined ? {} : { page }),
        contentHash,
      })),
  };
}

export function publicSeatChartRevision(revision: PublishedVenueRevision): PublicSeatChartRevision {
  return {
    chartKey: revision.chartKey,
    revisionId: revision.revisionId,
    venueId: revision.venueId,
    publishedAt: revision.publishedAt,
    contentHash: revision.contentHash,
    document: publicSeatChartDocument(revision.document),
  };
}

export function seatChartEtag(revision: Pick<PublishedVenueRevision, "contentHash">): string {
  return `"${revision.contentHash}"`;
}
