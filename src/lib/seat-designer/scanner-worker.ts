import {
  detectSeatCandidates,
  groupCandidatesIntoRows,
  type ScannerOptions,
} from "./scanner";

type ScannerWorkerRequest = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly options: ScannerOptions;
};

self.onmessage = (event: MessageEvent<ScannerWorkerRequest>) => {
  const result = detectSeatCandidates(
    { width: event.data.width, height: event.data.height, data: event.data.data },
    event.data.options,
  );
  const rows = groupCandidatesIntoRows(result.candidates, Math.max(4, event.data.options.maxDiameter));
  self.postMessage({ ...result, rows });
};
