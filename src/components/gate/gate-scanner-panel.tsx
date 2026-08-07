"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { GateApiError, parseGateQrPayload, verifyGateQr, type GateVerifyPayload } from "@/lib/gate-api";

const GATE_TOKEN_STORAGE_KEY = "ticketground:gate-token";
const GATE_LABEL_STORAGE_KEY = "ticketground:gate-label";
const GATE_QUEUE_STORAGE_KEY = "ticketground:gate-offline-queue";
const GATE_QUEUE_MAX = 30;
const SCAN_INTERVAL_MS = 400;
const RESCAN_COOLDOWN_MS = 3000;

interface QueuedScan {
  readonly id: string;
  readonly payload: GateVerifyPayload;
  readonly queuedAt: string;
}

interface ScanOutcome {
  readonly kind: "accepted" | "already-used" | "rejected" | "queued" | "error";
  readonly message: string;
  readonly detail?: string;
  readonly at: string;
}

// BarcodeDetector isn't in TypeScript's bundled DOM lib yet (too new/still
// behind flags on some browsers) - this is the minimal shape this file
// actually uses. jsQR (imported above) is the fallback for browsers
// without it, per 계획서 6장's "BarcodeDetector 우선, jsQR 폴백" decision.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
    };
  }
}

function loadQueue(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GATE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: readonly QueuedScan[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GATE_QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-GATE_QUEUE_MAX)));
}

function outcomeBadgeClass(kind: ScanOutcome["kind"]) {
  if (kind === "accepted") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (kind === "already-used") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (kind === "queued") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

export function GateScannerPanel() {
  const [gateToken, setGateToken] = useState<string | null>(null);
  const [gateLabel, setGateLabel] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [history, setHistory] = useState<ScanOutcome[]>([]);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [online, setOnline] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    setGateToken(window.localStorage.getItem(GATE_TOKEN_STORAGE_KEY));
    setGateLabel(window.localStorage.getItem(GATE_LABEL_STORAGE_KEY) ?? "");
    setQueue(loadQueue());
    setOnline(navigator.onLine);
  }, []);

  const recordOutcome = useCallback((entry: ScanOutcome) => {
    setOutcome(entry);
    setHistory((previous) => [entry, ...previous].slice(0, 50));
  }, []);

  const flushQueue = useCallback(async (token: string) => {
    const current = loadQueue();
    if (current.length === 0) return;
    const remaining: QueuedScan[] = [];
    for (const item of current) {
      try {
        const result = await verifyGateQr(token, item.payload);
        recordOutcome({
          kind: result.valid ? "accepted" : result.alreadyUsed ? "already-used" : "rejected",
          message: result.valid
            ? "입장 처리 완료 (대기열에서 전송됨)"
            : result.alreadyUsed
              ? "이미 처리된 QR입니다 (대기열에서 전송됨)"
              : "입장 불가 (대기열에서 전송됨)",
          at: new Date().toISOString(),
        });
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    setQueue(remaining);
  }, [recordOutcome]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      if (gateToken) void flushQueue(gateToken);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [gateToken, flushQueue]);

  useEffect(() => {
    if (gateToken) void flushQueue(gateToken);
    // Only on mount / when a token first becomes available - not on every
    // queue mutation, or flushQueue's own writes would retrigger itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateToken]);

  const saveGateToken = useCallback(() => {
    const token = tokenInput.trim();
    const label = labelInput.trim();
    if (!token) return;
    window.localStorage.setItem(GATE_TOKEN_STORAGE_KEY, token);
    if (label) window.localStorage.setItem(GATE_LABEL_STORAGE_KEY, label);
    setGateToken(token);
    setGateLabel(label);
    setTokenInput("");
    setLabelInput("");
  }, [tokenInput, labelInput]);

  const resetGateToken = useCallback(() => {
    window.localStorage.removeItem(GATE_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(GATE_LABEL_STORAGE_KEY);
    setGateToken(null);
    setGateLabel("");
    setScanning(false);
  }, []);

  const handleDecodedText = useCallback(async (raw: string, token: string) => {
    if (lastPayloadRef.current === raw) return;
    lastPayloadRef.current = raw;
    window.setTimeout(() => {
      if (lastPayloadRef.current === raw) lastPayloadRef.current = null;
    }, RESCAN_COOLDOWN_MS);

    let payload: GateVerifyPayload;
    try {
      payload = parseGateQrPayload(raw);
    } catch {
      recordOutcome({ kind: "error", message: "인식할 수 없는 QR입니다.", at: new Date().toISOString() });
      return;
    }

    try {
      const result = await verifyGateQr(token, payload);
      if (result.valid) {
        recordOutcome({ kind: "accepted", message: "입장 가능", at: new Date().toISOString() });
        return;
      }
      recordOutcome({
        kind: result.alreadyUsed ? "already-used" : "rejected",
        message: result.alreadyUsed ? "이미 사용된 QR입니다" : "입장 불가",
        detail: result.alreadyUsed
          ? `처리 게이트: ${result.usedByGateId ?? "알 수 없음"}${result.usedAt ? ` · ${new Date(result.usedAt).toLocaleTimeString("ko-KR")}` : ""}`
          : undefined,
        at: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof GateApiError && error.code === "NETWORK_ERROR") {
        const nextQueue = [
          ...loadQueue(),
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, payload, queuedAt: new Date().toISOString() },
        ].slice(-GATE_QUEUE_MAX);
        saveQueue(nextQueue);
        setQueue(nextQueue);
        recordOutcome({ kind: "queued", message: "오프라인 상태 - 온라인 연결 시 자동으로 확인됩니다", at: new Date().toISOString() });
        return;
      }
      recordOutcome({
        kind: "error",
        message: error instanceof GateApiError ? error.message : "게이트 인증에 실패했습니다.",
        at: new Date().toISOString(),
      });
    }
  }, [recordOutcome]);

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
    } catch {
      setCameraError("카메라를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.");
    }
  }, []);

  const stopScanning = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
  }, []);

  useEffect(() => {
    if (!scanning || !gateToken) return;
    let cancelled = false;
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            if (detector) {
              const codes = await detector.detect(canvas);
              if (codes[0]?.rawValue && gateToken) void handleDecodedText(codes[0].rawValue, gateToken);
            } else {
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data && gateToken) void handleDecodedText(code.data, gateToken);
            }
          } catch {
            // Transient decode failure (e.g. a half-visible frame) - retry next tick.
          }
        }
      }
      if (!cancelled) scanTimerRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS);
    }
    void tick();
    return () => {
      cancelled = true;
      if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    };
  }, [scanning, gateToken, handleDecodedText]);

  const submitManualPayload = useCallback(() => {
    if (!gateToken || !manualPayload.trim()) return;
    void handleDecodedText(manualPayload.trim(), gateToken);
    setManualPayload("");
  }, [gateToken, manualPayload, handleDecodedText]);

  if (!gateToken) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
        <div>
          <h1 className="text-xl font-bold text-ink-1">게이트 단말 등록</h1>
          <p className="mt-2 text-sm text-ink-3">
            관리자로부터 발급받은 게이트 토큰을 이 기기에 한 번만 등록하면, 이후에는 이 화면이 자동으로 스캐너로 전환됩니다.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-ink-2">
          게이트 이름 (선택, 이 기기에서만 표시됨)
          <input
            className="rounded-lg border border-ink-3/30 bg-transparent px-3 py-2 text-ink-1"
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="예: 정문 A"
            value={labelInput}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink-2">
          게이트 토큰
          <input
            className="rounded-lg border border-ink-3/30 bg-transparent px-3 py-2 font-mono text-ink-1"
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="관리자 화면에서 발급된 토큰을 붙여넣으세요"
            value={tokenInput}
          />
        </label>
        <button
          className="rounded-lg bg-ticketground px-4 py-3 font-bold text-on-ink-2 disabled:opacity-40"
          disabled={!tokenInput.trim()}
          onClick={saveGateToken}
          type="button"
        >
          이 기기 등록하기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-3">게이트 단말</p>
          <h1 className="text-lg font-bold text-ink-1">{gateLabel || "이름 없는 게이트"}</h1>
        </div>
        <button className="text-xs text-ink-3 underline" onClick={resetGateToken} type="button">
          토큰 재설정
        </button>
      </header>

      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${online ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
          {online ? "온라인" : "오프라인"}
        </span>
        {queue.length > 0 && (
          <span className="rounded-full border border-sky-500/30 px-2 py-1 text-sky-400">
            대기열 {queue.length}건
          </span>
        )}
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
        <video className="h-full w-full object-cover" muted playsInline ref={videoRef} />
        <canvas className="hidden" ref={canvasRef} />
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <button
              className="rounded-lg bg-ticketground px-4 py-3 font-bold text-on-ink-2"
              onClick={() => void startScanning()}
              type="button"
            >
              스캔 시작
            </button>
          </div>
        )}
        {scanning && (
          <button
            className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white"
            onClick={stopScanning}
            type="button"
          >
            스캔 중지
          </button>
        )}
      </div>
      {cameraError && <p className="text-sm text-red-400">{cameraError}</p>}

      {outcome && (
        <div className={`rounded-lg border px-4 py-3 ${outcomeBadgeClass(outcome.kind)}`} role="status">
          <p className="font-bold">{outcome.message}</p>
          {outcome.detail && <p className="mt-1 text-xs opacity-80">{outcome.detail}</p>}
        </div>
      )}

      <details className="rounded-lg border border-ink-3/20 px-3 py-2 text-sm text-ink-2">
        <summary className="cursor-pointer">카메라 대신 QR 값 직접 입력</summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="rounded-lg border border-ink-3/30 bg-transparent p-2 font-mono text-xs text-ink-1"
            onChange={(event) => setManualPayload(event.target.value)}
            placeholder='{"ticketId":"...","ownerId":"...","expiresAt":"...","nonce":"...","signature":"..."}'
            rows={3}
            value={manualPayload}
          />
          <button
            className="self-start rounded-lg border border-ink-3/30 px-3 py-1.5 text-xs font-bold text-ink-1 disabled:opacity-40"
            disabled={!manualPayload.trim()}
            onClick={submitManualPayload}
            type="button"
          >
            확인
          </button>
        </div>
      </details>

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-ink-3">최근 스캔</p>
          <ul className="flex flex-col gap-1">
            {history.slice(0, 10).map((entry, index) => (
              <li className="flex items-center justify-between text-xs text-ink-2" key={`${entry.at}-${index}`}>
                <span>{entry.message}</span>
                <span className="text-ink-3">{new Date(entry.at).toLocaleTimeString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
