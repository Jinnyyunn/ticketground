import { Copy, KeyRound, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiIssueSeatChartCredential,
  apiListSeatChartCredentials,
  apiRevokeSeatChartCredential,
  type ServiceCredentialSummary,
} from "@/lib/seat-charts/client";

export function ServiceCredentialsPanel({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const [records, setRecords] = useState<readonly ServiceCredentialSummary[]>(
    [],
  );
  const [issued, setIssued] = useState("");
  const [status, setStatus] = useState("불러오는 중…");

  async function load(): Promise<void> {
    setStatus("불러오는 중…");
    try {
      setRecords(await apiListSeatChartCredentials());
      setStatus("");
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? "API 키 목록을 불러오지 못했습니다."
          : "목록 오류",
      );
    }
  }

  useEffect(() => {
    let active = true;
    void apiListSeatChartCredentials()
      .then((items) => {
        if (!active) return;
        setRecords(items);
        setStatus("");
      })
      .catch(() => {
        if (!active) return;
        setStatus("API 키 목록을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function issue(): Promise<void> {
    setStatus("API 키 발급 중…");
    try {
      const result =
        await apiIssueSeatChartCredential("공연장 좌석 배치도 조회");
      setIssued(result.credential);
      await load();
    } catch (cause) {
      setStatus(
        cause instanceof Error ? "API 키를 발급하지 못했습니다." : "발급 오류",
      );
    }
  }

  async function revoke(id: string): Promise<void> {
    setStatus("API 키 폐기 중…");
    try {
      await apiRevokeSeatChartCredential(id);
      await load();
    } catch (cause) {
      setStatus(
        cause instanceof Error ? "API 키를 폐기하지 못했습니다." : "폐기 오류",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[var(--editor-overlay)] p-6"
      data-testid="seat-designer-v2-service-credentials"
    >
      <section className="w-full max-w-2xl rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--editor-border)] px-5 py-4">
          <KeyRound className="size-5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">좌석 배치도 API 연결</h2>
            <p className="mt-0.5 text-xs text-[var(--editor-muted)]">
              게시된 공연장 좌석 배치도를 서버에서 읽는 전용 키입니다.
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded hover:bg-[var(--editor-hover)]"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          {issued && (
            <div className="rounded border border-[var(--editor-warning-border)] bg-[var(--editor-warning-soft)] p-4 text-[var(--editor-warning)]">
              <strong className="text-sm">
                이 키는 지금 한 번만 표시됩니다.
              </strong>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded bg-[var(--editor-surface)] px-3 py-2 text-xs">
                  {issued}
                </code>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded border bg-[var(--editor-surface)]"
                  title="복사"
                  onClick={() => void navigator.clipboard.writeText(issued)}
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--editor-muted)]">
              Authorization: Bearer 헤더로 공연장 공개 리비전을 조회합니다.
            </p>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded bg-[var(--editor-accent)] px-3 font-semibold text-[var(--editor-on-accent)]"
              onClick={() => void issue()}
            >
              <KeyRound className="size-4" />
              읽기 키 발급
            </button>
          </div>
          <div className="divide-y rounded border border-[var(--editor-border)] bg-[var(--editor-surface)]">
            {records.length ? (
              records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{record.label}</p>
                    <p className="mt-1 text-xs text-[var(--editor-muted)]">
                      {record.prefix}••••{record.suffix} · 만료{" "}
                      {new Date(record.expiresAt).toLocaleDateString("ko-KR")}
                      {record.revokedAt ? " · 폐기됨" : ""}
                    </p>
                  </div>
                  {!record.revokedAt && (
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded text-[var(--editor-danger)] hover:bg-[var(--editor-danger-soft)]"
                      title="키 폐기"
                      onClick={() => void revoke(record.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-[var(--editor-muted)]">
                발급된 API 키가 없습니다.
              </p>
            )}
          </div>
          {status && (
            <p
              className="flex items-center gap-2 text-sm text-[var(--editor-muted)]"
              aria-live="polite"
            >
              <RefreshCw className="size-4" />
              {status}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
