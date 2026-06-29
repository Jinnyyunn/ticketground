export type ApiEvent = {
  readonly id: string;
  readonly title: string;
  readonly venue: string;
  readonly venueId: string;
  readonly category: string;
  readonly saleState: string;
  readonly sale: {
    readonly label: string;
    readonly state: string;
    readonly bookable: boolean;
  };
};

export type ApiTicket = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly seatLabel: string;
  readonly status: string;
  readonly available: boolean;
  readonly faceValue: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly transferCount: number;
  readonly maxTransferCount: number;
  readonly issuedAt: string | null;
};

export type ApiResalePool = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly ticketId: string;
  readonly price: number;
  readonly buyerFee: number | null;
  readonly buyerTotal: number | null;
  readonly sellerSettlement: number | null;
  readonly buyerCount: number;
  readonly status: string;
  readonly createdAt: string;
  readonly matchedAt: string | null;
};

export type ApiState = {
  readonly events: readonly ApiEvent[];
  readonly tickets: readonly ApiTicket[];
  readonly resalePools: readonly ApiResalePool[];
  readonly backendSummary: {
    readonly events: number;
    readonly tickets: number;
  };
  readonly ledger: {
    readonly verified: boolean;
    readonly totalEntries: number;
  };
};

export type ApiSeat = {
  readonly id: string;
  readonly label: string;
  readonly displayCode: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly price: number;
  readonly status: string;
  readonly available: boolean;
};

export type ApiSeatMap = {
  readonly event: {
    readonly id: string;
    readonly title: string;
    readonly venueId: string;
    readonly venue: string;
  };
  readonly map: {
    readonly title: string;
    readonly image: string;
    readonly description: string;
  };
  readonly zones: readonly {
    readonly id: string;
    readonly name: string;
    readonly price: number;
    readonly available: number;
  }[];
  readonly seats: readonly ApiSeat[];
};

export type ApiPurchaseResult = {
  readonly ticket: ApiTicket;
  readonly event: {
    readonly id: string;
    readonly title: string;
    readonly venue: string;
  };
  readonly payment: {
    readonly method: string;
    readonly label: string;
    readonly status: string;
  };
  readonly admission: {
    readonly status: string;
    readonly activeAt: string;
    readonly activationChannel: string;
  };
};

export type ApiResaleResult = {
  readonly pool: ApiResalePool;
  readonly ticket: ApiTicket;
  readonly fee: number;
  readonly buyerTotal: number;
  readonly sellerSettlement: number;
  readonly payment: {
    readonly method: string;
    readonly label: string;
    readonly status: string;
  };
};

export type ApiVirtualQr = {
  readonly type: string;
  readonly ticketId: string;
  readonly issuedAt: string;
  readonly eventTitle: string;
  readonly seatLabel: string;
  readonly performanceStartsAt: string;
  readonly realQrAvailableAt: string;
  readonly admissionChannel: string;
};

export type ApiSession = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly trustScore: number;
};

export type ApiWatchlistItem = {
  readonly id: string;
  readonly eventId: string;
  readonly channels: readonly string[];
  readonly calendarEnabled: boolean;
  readonly notificationEnabled: boolean;
  readonly notificationJobs: readonly {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly status: string;
    readonly scheduledAt: string;
  }[];
};

export type ApiSupportThread = {
  readonly id: string;
  readonly userId: string;
  readonly subject: string;
  readonly status: "OPEN" | "ANSWERED" | "CLOSED";
  readonly updatedAt: string;
  readonly messages: readonly {
    readonly id: string;
    readonly actorId: string;
    readonly role: "CUSTOMER" | "ADMIN";
    readonly body: string;
    readonly at: string;
  }[];
};

export type ApiDirectTransferResult = {
  readonly blocked: boolean;
  readonly user: {
    readonly id: string;
    readonly name: string;
  };
  readonly ticket: ApiTicket;
};
