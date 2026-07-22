"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import type { GroupBookingCatalogEvent } from "@/data/catalog-server";

const orgTypeOptions = [
  { label: "학교", value: "SCHOOL" },
  { label: "학원", value: "ACADEMY" },
  { label: "복지기관", value: "WELFARE" },
  { label: "기업", value: "COMPANY" },
  { label: "지자체", value: "GOVERNMENT" },
  { label: "기타", value: "OTHER" },
] as const;

const paymentMethodOptions = [
  { label: "카드", value: "CARD" },
  { label: "세금계산서", value: "TAX_INVOICE" },
  { label: "계좌이체", value: "BANK_TRANSFER" },
] as const;

const maxFileBytes = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("파일을 읽지 못했습니다."))));
    reader.addEventListener("error", () => reject(new Error("파일을 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

type SubmitState = { readonly status: "idle" | "submitting" | "success" | "error"; readonly message?: string };

export function GroupBookingForm({ events }: { readonly events: readonly GroupBookingCatalogEvent[] }) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    setFileError("");
    setFileName(file?.name ?? "");
    if (file && file.size > maxFileBytes) {
      setFileError("파일 용량은 10MB 이하만 등록할 수 있습니다.");
      event.currentTarget.value = "";
      setFileName("");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedEvent) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("businessRegistrationFile");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!file) {
      setSubmitState({ status: "error", message: "사업자등록증/고유번호증 파일을 첨부해주세요." });
      return;
    }
    const expectedHeadcount = Number(formData.get("expectedHeadcount"));
    if (!Number.isInteger(expectedHeadcount) || expectedHeadcount < 1) {
      setSubmitState({ status: "error", message: "예상 인원을 확인해주세요." });
      return;
    }
    setSubmitState({ status: "submitting" });
    void (async () => {
      try {
        const businessRegistrationFileUrl = await readFileAsDataUrl(file);
        const response = await fetch("/api/group-booking/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgName: formData.get("orgName"),
            orgType: formData.get("orgType"),
            contactName: formData.get("contactName"),
            contactPhone: formData.get("contactPhone"),
            contactEmail: formData.get("contactEmail"),
            businessRegistrationFileUrl,
            eventId: selectedEvent.id,
            performanceDateId: formData.get("performanceDateId"),
            zoneId: formData.get("zoneId"),
            expectedHeadcount,
            paymentMethod: formData.get("paymentMethod"),
            requestNote: formData.get("requestNote") || undefined,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload?.error?.message || "신청서를 접수하지 못했습니다.");
        }
        setSubmitState({ status: "success" });
        form.reset();
        setFileName("");
      } catch (error) {
        setSubmitState({ status: "error", message: error instanceof Error ? error.message : "신청서를 접수하지 못했습니다." });
      }
    })();
  };

  if (!events.length) {
    return <p className="rounded-lg border border-line bg-surface p-4 text-sm font-bold text-ink-3">현재 단체 예매를 신청할 수 있는 공연이 없습니다.</p>;
  }

  if (submitState.status === "success") {
    return (
      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="text-base font-black text-ink">신청이 접수되었습니다.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          담당자 검토 후 입력하신 이메일 또는 연락처로 결과를 안내해드립니다. 승인 전까지는 좌석이 확정되지
          않습니다.
        </p>
      </div>
    );
  }

  return (
    <form className="grid min-w-0 gap-4" noValidate onSubmit={submit}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          기관명
          <input className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="orgName" required />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          기관 유형
          <select className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={orgTypeOptions[0].value} name="orgType">
            {orgTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          담당자명
          <input className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactName" required />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          담당자 휴대폰 번호
          <input className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactPhone" placeholder="01012345678" required type="tel" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3 sm:col-span-2">
          기관 이메일
          <input className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactEmail" required type="email" />
        </label>
      </div>

      <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
        사업자등록증/고유번호증 첨부
        <input accept="image/jpeg,image/png,image/webp,application/pdf" className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="businessRegistrationFile" onChange={handleFileChange} required type="file" />
        <span className="text-xs font-bold text-ink-4">PNG, JPEG, WebP, PDF · 최대 10MB{fileName ? ` · 선택됨: ${fileName}` : ""}</span>
        {fileError ? <span className="text-xs font-bold text-ticketground">{fileError}</span> : null}
      </label>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          희망 공연
          <select className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" onChange={(event) => setSelectedEventId(event.currentTarget.value)} value={selectedEventId}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.venue}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          예상 인원
          <input className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" min={1} name="expectedHeadcount" required type="number" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3" key={`dates-${selectedEvent?.id}`}>
          희망 날짜/회차
          <select className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="performanceDateId">
            {selectedEvent?.dates.map((date) => <option key={date.id} value={date.id}>{date.label} · {date.startsAt.slice(0, 16).replace("T", " ")}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3" key={`zones-${selectedEvent?.id}`}>
          희망 좌석등급
          <select className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="zoneId">
            {selectedEvent?.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.faceValue.toLocaleString("ko-KR")}원</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
          결제 방식
          <select className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={paymentMethodOptions[0].value} name="paymentMethod">
            {paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <label className="grid min-w-0 gap-1 text-sm font-bold text-ink-3">
        요청사항 (선택)
        <textarea className="min-h-24 min-w-0 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="requestNote" rows={3} />
      </label>

      {submitState.status === "error" ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{submitState.message}</p> : null}

      <button className="h-12 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:opacity-60" disabled={submitState.status === "submitting"} type="submit">
        {submitState.status === "submitting" ? "제출 중..." : "단체 예매 신청서 제출"}
      </button>
    </form>
  );
}
