import { Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  digitsOnly,
  emptyPriceRow,
  emptyScheduleRow,
  formatWon,
  maxPriceRows,
  maxScheduleRows,
  maxTimesPerSchedule,
  maxZoneSeatCount,
  type DraftIssue,
  type PriceRow,
  type ScheduleRow,
} from "./event-draft";

const rowShellClass = "grid gap-2 rounded-lg border border-line bg-background p-3";
const inputClass = "h-10 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink";
const subLabelClass = "grid gap-1 text-xs font-bold text-ink-3";
const iconButtonClass = "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-ink-3 hover:border-ticketground hover:text-ticketground disabled:opacity-40";
const addButtonClass = "flex h-10 items-center justify-center gap-1 rounded-lg border border-dashed border-line px-4 text-sm font-black text-ink-3 hover:border-ticketground hover:text-ticketground disabled:opacity-40";

export function PriceRowsField({ rows, onChange }: { readonly rows: readonly PriceRow[]; readonly onChange: (rows: readonly PriceRow[]) => void }) {
  const update = (id: string, patch: Partial<PriceRow>): void => {
    onChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold text-ink-3">좌석 가격</legend>
      {rows.map((row, index) => (
        <div className={rowShellClass} key={row.id}>
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-4">
              <label className={subLabelClass}>
                등급 (영문/숫자 포함)
                <input className={inputClass} onChange={(event) => update(row.id, { grade: event.currentTarget.value })} placeholder="VIP" value={row.grade} />
              </label>
              <label className={subLabelClass}>
                좌석명
                <input className={inputClass} onChange={(event) => update(row.id, { seat: event.currentTarget.value })} placeholder="VIP석" value={row.seat} />
              </label>
              <label className={subLabelClass}>
                가격 (원)
                <input
                  className={`${inputClass} text-right tabular-nums`}
                  inputMode="numeric"
                  onChange={(event) => update(row.id, { price: digitsOnly(event.currentTarget.value) })}
                  placeholder="154,000"
                  value={formatWon(row.price)}
                />
              </label>
              <label className={subLabelClass}>
                판매 좌석 수
                <input className={inputClass} max={maxZoneSeatCount} min={1} onChange={(event) => update(row.id, { seatCount: event.currentTarget.value })} type="number" value={row.seatCount} />
              </label>
            </div>
            <button aria-label={`${index + 1}번째 좌석 등급 삭제`} className={`${iconButtonClass} mt-5`} disabled={rows.length <= 1} onClick={() => onChange(rows.filter((item) => item.id !== row.id))} type="button">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
      <button className={addButtonClass} disabled={rows.length >= maxPriceRows} onClick={() => onChange([...rows, emptyPriceRow()])} type="button">
        <Plus size={16} />좌석 등급 추가
      </button>
    </fieldset>
  );
}

export function ScheduleRowsField({ rows, onChange }: { readonly rows: readonly ScheduleRow[]; readonly onChange: (rows: readonly ScheduleRow[]) => void }) {
  const update = (id: string, patch: Partial<ScheduleRow>): void => {
    onChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold text-ink-3">공연 일정</legend>
      {rows.map((row, index) => (
        <div className={rowShellClass} key={row.id}>
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
              <label className={subLabelClass}>
                회차명
                <input className={inputClass} onChange={(event) => update(row.id, { label: event.currentTarget.value })} placeholder={`${index + 1}회차`} value={row.label} />
              </label>
              <label className={subLabelClass}>
                날짜
                <input className={inputClass} onChange={(event) => update(row.id, { date: event.currentTarget.value })} type="date" value={row.date} />
              </label>
            </div>
            <button aria-label={`${index + 1}번째 회차 삭제`} className={`${iconButtonClass} mt-5`} disabled={rows.length <= 1} onClick={() => onChange(rows.filter((item) => item.id !== row.id))} type="button">
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-bold text-ink-3">공연 시간</span>
            <div className="flex flex-wrap items-center gap-2">
              {row.times.map((time, timeIndex) => (
                <div className="flex items-center gap-1" key={`${row.id}-time-${timeIndex}`}>
                  <input
                    aria-label={`${index + 1}번째 회차 ${timeIndex + 1}번째 공연 시간`}
                    className={inputClass}
                    onChange={(event) => update(row.id, { times: row.times.map((item, position) => position === timeIndex ? event.currentTarget.value : item) })}
                    type="time"
                    value={time}
                  />
                  <button
                    aria-label={`${index + 1}번째 회차 ${timeIndex + 1}번째 공연 시간 삭제`}
                    className={iconButtonClass}
                    disabled={row.times.length <= 1}
                    onClick={() => update(row.id, { times: row.times.filter((_, position) => position !== timeIndex) })}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button className={addButtonClass} disabled={row.times.length >= maxTimesPerSchedule} onClick={() => update(row.id, { times: [...row.times, ""] })} type="button">
                <Plus size={16} />시간 추가
              </button>
            </div>
          </div>
        </div>
      ))}
      <button className={addButtonClass} disabled={rows.length >= maxScheduleRows} onClick={() => onChange([...rows, emptyScheduleRow()])} type="button">
        <Plus size={16} />회차 추가
      </button>
    </fieldset>
  );
}

export function DraftIssueList({ issues }: { readonly issues: readonly DraftIssue[] }) {
  if (!issues.length) return null;
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return (
    <div aria-live="polite" className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      <p className="flex items-center gap-2 text-sm font-black text-ink">
        <TriangleAlert size={16} />
        등록 전 확인 {errors.length ? `· 오류 ${errors.length}건` : ""}{warnings.length ? ` · 확인 필요 ${warnings.length}건` : ""}
      </p>
      <ul className="grid gap-1">
        {errors.concat(warnings).map((issue, index) => (
          <li className={`text-xs font-bold ${issue.level === "error" ? "text-ticketground" : "text-warn"}`} key={`${issue.level}-${index}`}>
            {issue.level === "error" ? "오류" : "확인"} · {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
