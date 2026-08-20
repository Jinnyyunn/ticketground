"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, RotateCcw } from "lucide-react";
import {
  apiIssueSeatChartCredential,
  apiListSeatChartCredentials,
  apiRevokeSeatChartCredential,
  type ServiceCredentialSummary,
} from "@/lib/seat-charts/client";

export function ServiceCredentialPanel({ active }: { readonly active: boolean }) {
  const [records, setRecords] = useState<readonly ServiceCredentialSummary[]>([]);
  const [label, setLabel] = useState("좌석 배치도 조회");
  const [issued, setIssued] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!active) return;
    void apiListSeatChartCredentials().then(setRecords).catch(() => setStatus("API 키 목록을 불러오지 못했습니다."));
  }, [active]);

  async function issue() {
    setStatus("API 키를 생성하는 중입니다.");
    try {
      const result = await apiIssueSeatChartCredential(label);
      setIssued(result.credential);
      setRecords((current) => [result.record, ...current]);
      setStatus("새 키가 생성되었습니다. 지금 안전한 곳에 복사하세요.");
    } catch {
      setStatus("API 키를 생성하지 못했습니다.");
    }
  }

  async function revoke(id: string) {
    setStatus("API 키를 폐기하는 중입니다.");
    try {
      await apiRevokeSeatChartCredential(id);
      setRecords((current) => current.map((record) => record.id === id ? { ...record, revokedAt: new Date().toISOString() } : record));
      setStatus("API 키가 폐기되었습니다.");
    } catch {
      setStatus("API 키를 폐기하지 못했습니다.");
    }
  }

  return (
    <section className="space-y-3" data-testid="seat-chart-api-keys">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--editor-text)]"><KeyRound className="size-4" /> 좌석 배치도 API 키</h3>
        <p className="mt-1 break-keep text-xs text-[var(--editor-muted)]">외부 서버가 게시된 공연장 좌석 배치도를 읽을 때 사용합니다. 키는 생성 직후 한 번만 표시됩니다.</p>
      </div>
      <div className="flex gap-2">
        <input aria-label="API 키 이름" value={label} onChange={(event) => setLabel(event.target.value)} className="min-w-0 flex-1 rounded-md border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 py-2 text-sm" />
        <button type="button" disabled={!label.trim()} onClick={() => void issue()} className="rounded-md bg-[var(--editor-accent)] px-3 py-2 text-sm font-bold text-white disabled:opacity-40">읽기 키 생성</button>
      </div>
      {issued ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="break-keep text-xs font-bold text-amber-900">이 키는 다시 표시되지 않습니다.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs">{issued}</code>
            <button type="button" aria-label="API 키 복사" onClick={() => void navigator.clipboard.writeText(issued)} className="rounded border border-amber-300 bg-white p-2"><Copy className="size-4" /></button>
          </div>
        </div>
      ) : null}
      <ul className="space-y-2">
        {records.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--editor-border)] p-3 text-xs">
            <div className="min-w-0"><p className="truncate font-bold">{record.label}</p><p className="text-[var(--editor-muted)]">{record.prefix}••••{record.suffix} · {record.revokedAt ? "폐기됨" : `${record.expiresAt.slice(0, 10)} 만료`}</p></div>
            {!record.revokedAt ? <button type="button" aria-label={`${record.label} 폐기`} onClick={() => void revoke(record.id)} className="rounded border border-[var(--editor-border)] p-2 text-red-600"><RotateCcw className="size-4" /></button> : null}
          </li>
        ))}
      </ul>
      {status ? <p aria-live="polite" className="text-xs text-[var(--editor-muted)]">{status}</p> : null}
    </section>
  );
}
