export type Point = { readonly x: number; readonly y: number };

export type Category = {
  readonly key: string;
  readonly label: string;
  readonly color: string;
};

export type SelectionLayer =
  | "all"
  | "foreground"
  | "interactive"
  | "background"
  | "surroundings";

export type ObjectLayer = Exclude<SelectionLayer, "all">;

export type ToolId =
  | "select"
  | "selectSeats"
  | "brush"
  | "selectSame"
  | "node"
  | "focal"
  | "row"
  | "section"
  | "table"
  | "booth"
  | "area"
  | "rectangle"
  | "line"
  | "text"
  | "image"
  | "icon"
  | "hand";

/** Venue type (seats.io venueType.*) */
export type VenueType = "simple" | "sectionsAndFloors" | "zones";

export type OverlayImage = {
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
  readonly locked?: boolean;
};

export type SeatChartAsset = {
  readonly id: string;
  readonly kind: "reference" | "background" | "object";
  readonly mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml" | "application/pdf";
  readonly width: number;
  readonly height: number;
  readonly page?: number;
  readonly contentHash: string;
};

export type Zone = {
  readonly id: string;
  readonly name: string;
};

export type SeatPlace = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly categoryKey?: string;
  /** Buyer-facing label override */
  readonly displayedLabel?: string;
  /** View-from-your-seat image (data URL or path) */
  readonly viewFromSeatHref?: string;
};

export type BaseObject = {
  readonly id: string;
  readonly label: string;
  readonly layer: ObjectLayer;
  readonly categoryKey?: string;
  readonly rotation?: number;
  readonly locked?: boolean;
  /** Buyer-facing displayed label (displayedLabels feature) */
  readonly displayedLabel?: string;
  /** View from seat image on object */
  readonly viewFromSeatHref?: string;
  /** Floor this object belongs to */
  readonly floorId?: string;
  /** Zone this object belongs to */
  readonly zoneId?: string;
};

export type RowObject = BaseObject & {
  readonly type: "row";
  readonly start: Point;
  readonly end: Point;
  readonly seatCount: number;
  readonly curve?: number;
  /** 0–1 smoothing along the path */
  readonly smooth?: number;
  readonly seats: readonly SeatPlace[];
};

export type SectionObject = BaseObject & {
  readonly type: "section";
  readonly points: readonly Point[];
  readonly fill?: string;
  readonly capacity?: number;
  readonly nestedRows?: readonly RowObject[];
};

export type TableObject = BaseObject & {
  readonly type: "table";
  readonly center: Point;
  readonly radius: number;
  readonly seatCount: number;
  /** tables.bookAsAWhole */
  readonly bookAsWhole?: boolean;
  /** tables.variableOccupancy */
  readonly variableOccupancy?: boolean;
  readonly minOccupancy?: number;
  readonly maxOccupancy?: number;
  readonly seats: readonly SeatPlace[];
};

export type BoothObject = BaseObject & {
  readonly type: "booth";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type AreaObject = BaseObject & {
  readonly type: "area";
  readonly points: readonly Point[];
  readonly capacity: number;
};

export type RectangleObject = BaseObject & {
  readonly type: "rectangle";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly stroke?: string;
};

export type LineObject = BaseObject & {
  readonly type: "line";
  readonly start: Point;
  readonly end: Point;
  readonly stroke?: string;
};

export type TextObject = BaseObject & {
  readonly type: "text";
  readonly position: Point;
  readonly text: string;
  readonly fontSize?: number;
  readonly color?: string;
};

export type ImageObject = BaseObject & {
  readonly type: "image";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly href: string;
};

export type IconObject = BaseObject & {
  readonly type: "icon";
  readonly position: Point;
  readonly icon: "stage" | "entrance" | "wc" | "star";
  readonly size?: number;
};

export type ChartObject =
  | RowObject
  | SectionObject
  | TableObject
  | BoothObject
  | AreaObject
  | RectangleObject
  | LineObject
  | TextObject
  | ImageObject
  | IconObject;

export type Floor = {
  readonly id: string;
  readonly name: string;
  readonly index: number;
};

export type Viewport = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

export type ChartDocument = {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly Category[];
  readonly objects: readonly ChartObject[];
  readonly floors: readonly Floor[];
  readonly activeFloorId: string;
  readonly focalPoint?: Point;
  /** Buyer-visible background (backgroundImage) */
  readonly backgroundImage?: OverlayImage | string;
  /** Trace-over reference plan (referenceChart) */
  readonly referenceChart?: OverlayImage;
  readonly venueType?: VenueType;
  readonly zones?: readonly Zone[];
  /** publishing feature */
  readonly published?: boolean;
  readonly publishedAt?: string;
};

export type SeatChartDocumentV2 = Omit<ChartDocument, "published" | "publishedAt"> & {
  readonly version: 2;
  readonly chartKey: `chart_${string}`;
  readonly venueId: string;
  readonly venueType: VenueType;
  readonly zones: readonly Zone[];
  readonly assets: readonly SeatChartAsset[];
  readonly draftRevision: number;
};

export type EditorSettings = {
  readonly snapToGrid: boolean;
  readonly gridSize: number;
  readonly showSectionContents: boolean;
  readonly alwaysShowLabels: boolean;
  readonly darkCanvas: boolean;
  readonly selectionLayer: SelectionLayer;
  /** Show reference chart overlay while editing */
  readonly showReferenceChart: boolean;
  /** Show buyer background while editing */
  readonly showBackgroundImage: boolean;
};
