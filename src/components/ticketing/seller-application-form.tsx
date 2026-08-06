"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

const orgTypeOptions = [
  { label: "기획사", value: "AGENCY" },
  { label: "제작사", value: "PRODUCTION" },
  { label: "공연장", value: "VENUE" },
  { label: "문화재단", value: "FOUNDATION" },
  { label: "스포츠구단", value: "SPORTS_CLUB" },
  { label: "기타", value: "OTHER" },
] as const;

const categoryOptions = [
  { label: "뮤지컬", value: "musical" },
  { label: "콘서트", value: "concert" },
  { label: "연극", value: "theater" },
  { label: "클래식", value: "classic" },
  { label: "스포츠", value: "sports" },
  { label: "전시·행사", value: "exhibition" },
  { label: "아동·가족", value: "children" },
] as const;

const channelTypeOptions = [
  { label: "전용판매", value: "EXCLUSIVE" },
  { label: "공동판매", value: "SHARED" },
  { label: "좌석우위판매", value: "SEAT_PRIORITY" },
  { label: "프리세일 참여", value: "PRESALE" },
] as const;

const maxFileBytes = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("파일을 읽지 못했습니다."))));
    reader.addEventListener("error", () => reject(new Error("파일을 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function parseSessions(text: string): { label: string; date: string; times: string[] }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, date, times] = line.split("|");
      return { label: (label || "").trim(), date: (date || "").trim(), times: (times || "").split(",").map((time) => time.trim()).filter(Boolean) };
    });
}

function parseSeatGrades(text: string): { gradeName: string; price: number; quantity: number }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [gradeName, price, quantity] = line.split(",").map((part) => part.trim());
      return { gradeName: gradeName || "", price: Number(price), quantity: Number(quantity) };
    });
}

type SubmitState = { readonly status: "idle" | "submitting" | "success" | "error"; readonly message?: string };

export function SellerApplicationForm() {
  const [bizDocName, setBizDocName] = useState("");
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const handleBizDocChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    setFileError("");
    setBizDocName(file?.name ?? "");
    if (file && file.size > maxFileBytes) {
      setFileError("사업자등록증 파일 용량은 5MB 이하만 등록할 수 있습니다.");
      event.currentTarget.value = "";
      setBizDocName("");
    }
  };

  const handlePosterChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setPosterPreview(null);
      return;
    }
    if (file.size > maxFileBytes) {
      setFileError("포스터 파일 용량은 5MB 이하만 등록할 수 있습니다.");
      event.currentTarget.value = "";
      setPosterPreview(null);
      return;
    }
    setFileError("");
    readFileAsDataUrl(file).then(setPosterPreview).catch(() => setPosterPreview(null));
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const bizDocInput = form.elements.namedItem("bizRegistrationDoc");
    const bizDocFile = bizDocInput instanceof HTMLInputElement ? bizDocInput.files?.[0] : undefined;
    const posterInput = form.elements.namedItem("posterImage");
    const posterFile = posterInput instanceof HTMLInputElement ? posterInput.files?.[0] : undefined;
    if (!bizDocFile) {
      setSubmitState({ status: "error", message: "사업자등록증 파일을 첨부해주세요." });
      return;
    }
    if (!posterFile) {
      setSubmitState({ status: "error", message: "제안 포스터 이미지를 첨부해주세요." });
      return;
    }
    if (formData.get("privacyConsent") !== "on" || formData.get("preliminaryAcknowledged") !== "on") {
      setSubmitState({ status: "error", message: "필수 동의 항목을 확인해주세요." });
      return;
    }
    const sessions = parseSessions(String(formData.get("sessions") || ""));
    const seatGrades = parseSeatGrades(String(formData.get("seatGrades") || ""));
    if (!sessions.length || sessions.some((session) => !session.date || !session.times.length)) {
      setSubmitState({ status: "error", message: "공연 일정을 형식에 맞게 입력해주세요." });
      return;
    }
    if (!seatGrades.length || seatGrades.some((grade) => !grade.gradeName || !Number.isFinite(grade.price) || !Number.isFinite(grade.quantity))) {
      setSubmitState({ status: "error", message: "좌석 등급/가격/수량을 형식에 맞게 입력해주세요." });
      return;
    }

    setSubmitState({ status: "submitting" });
    void (async () => {
      try {
        const [bizRegistrationDocDataUrl, posterImageDataUrl] = await Promise.all([
          readFileAsDataUrl(bizDocFile),
          readFileAsDataUrl(posterFile),
        ]);
        const response = await fetch("/api/seller-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization: {
              legalName: formData.get("legalName"),
              orgType: formData.get("orgType"),
              bizRegistrationNumber: formData.get("bizRegistrationNumber"),
              bizRegistrationDocDataUrl,
              representativeName: formData.get("representativeName"),
              address: formData.get("address") || undefined,
              website: formData.get("website") || undefined,
            },
            contact: {
              name: formData.get("contactName"),
              title: formData.get("contactTitle") || undefined,
              phone: formData.get("contactPhone"),
              email: formData.get("contactEmail"),
            },
            proposedEvent: {
              title: formData.get("title"),
              category: formData.get("category"),
              venueName: formData.get("venueName"),
              sessions,
              seatGrades,
              desiredSaleOpenDate: formData.get("desiredSaleOpenDate") || undefined,
              eventDateRange: formData.get("eventDateRange") || undefined,
              discountPolicyNotes: formData.get("discountPolicyNotes") || undefined,
              posterImageDataUrl,
              castNotes: formData.get("castNotes") || undefined,
              summaryDraft: formData.get("summaryDraft") || undefined,
              noticesDraft: formData.get("noticesDraft") || undefined,
            },
            saleTerms: {
              channelType: formData.get("channelType"),
              requestedCommissionNotes: formData.get("requestedCommissionNotes") || undefined,
              settlement: {
                bankName: formData.get("bankName"),
                accountNumber: formData.get("accountNumber"),
                accountHolder: formData.get("accountHolder"),
              },
            },
            otherNotes: formData.get("otherNotes") || undefined,
            privacyConsent: true,
            preliminaryAcknowledged: true,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload?.error?.message || "신청서를 접수하지 못했습니다.");
        }
        setSubmitState({ status: "success" });
        form.reset();
        setBizDocName("");
        setPosterPreview(null);
      } catch (error) {
        setSubmitState({ status: "error", message: error instanceof Error ? error.message : "신청서를 접수하지 못했습니다." });
      }
    })();
  };

  if (submitState.status === "success") {
    return (
      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="text-base font-black text-ink">신청이 접수되었습니다.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          담당자가 사업자 정보와 공연 내용을 확인한 뒤 결과를 안내해드립니다. 이 신청은 예비 신청이며,
          실제 판매 계약과 카탈로그 등록은 승인 이후 별도로 진행됩니다.
        </p>
      </div>
    );
  }

  return (
    <form className="grid gap-6" noValidate onSubmit={submit}>
      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-black text-ink">기관 정보</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            법인/기관명
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="legalName" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            기관 유형
            <select className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={orgTypeOptions[0].value} name="orgType">
              {orgTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            사업자등록번호
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="bizRegistrationNumber" placeholder="000-00-00000" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            대표자명
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="representativeName" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            주소 (선택)
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="address" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            홈페이지/SNS (선택)
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="website" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          사업자등록증 첨부
          <input accept="image/jpeg,image/png,image/webp,application/pdf" className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="bizRegistrationDoc" onChange={handleBizDocChange} required type="file" />
          <span className="text-xs font-bold text-ink-4">PNG, JPEG, WebP, PDF · 최대 5MB{bizDocName ? ` · 선택됨: ${bizDocName}` : ""}</span>
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-black text-ink">담당자 정보</legend>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          담당자명
          <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactName" required />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          직책 (선택)
          <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactTitle" />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          연락처
          <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactPhone" placeholder="01012345678" required type="tel" />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          이메일
          <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="contactEmail" required type="email" />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-black text-ink">제안 공연 정보</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            공연/행사명
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="title" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            장르
            <select className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={categoryOptions[0].value} name="category">
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            공연장/장소
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="venueName" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            예매 오픈 희망일 (선택)
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="desiredSaleOpenDate" placeholder="2026-10-01" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3 sm:col-span-2">
            공연 기간 (선택)
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="eventDateRange" placeholder="2026.12.24 ~ 2026.12.31" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          공연 일정
          <textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="sessions" required rows={3} />
          <span className="text-xs font-bold text-ink-4">한 줄에 하나씩: 회차명|날짜(YYYY-MM-DD)|시간1,시간2 (예: 1회차|2026-12-24|19:30)</span>
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          좌석 등급/가격/수량
          <textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="seatGrades" required rows={3} />
          <span className="text-xs font-bold text-ink-4">한 줄에 하나씩: 등급명,가격,수량 (예: VIP,154000,20)</span>
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          할인 정책 제안 (선택)
          <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="discountPolicyNotes" rows={2} />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          제안 포스터 첨부
          <input accept="image/jpeg,image/png,image/webp" className="h-11 min-w-0 rounded-lg border border-line bg-background px-3 py-1 text-sm font-bold text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-sm file:font-bold" name="posterImage" onChange={handlePosterChange} required type="file" />
        </label>
        {posterPreview ? <img alt="제안 포스터 미리보기" className="h-40 w-28 rounded-lg border border-line object-cover" src={posterPreview} /> : null}
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          출연진 (선택)
          <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="castNotes" rows={2} />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          공연 소개 초안 (선택, 최대 400자)
          <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" maxLength={400} name="summaryDraft" rows={2} />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          예매 공지 초안 (선택)
          <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="noticesDraft" rows={2} />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-black text-ink">판매 조건</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            희망 판매 형태
            <select className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={channelTypeOptions[0].value} name="channelType">
              {channelTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            은행명
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="bankName" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            계좌번호
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="accountNumber" required />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink-3">
            예금주
            <input className="h-11 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" name="accountHolder" required />
          </label>
        </div>
        <p className="text-xs font-bold text-ink-4">정산 계좌는 승인 이후 수동 정산에 사용되며, 자동 정산은 아직 지원하지 않습니다.</p>
        <label className="grid gap-1 text-sm font-bold text-ink-3">
          수수료/정산 조건 제안 (선택)
          <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="requestedCommissionNotes" rows={2} />
        </label>
      </fieldset>

      <label className="grid gap-1 text-sm font-bold text-ink-3">
        기타 요청사항 (선택)
        <textarea className="min-h-20 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" name="otherNotes" rows={2} />
      </label>

      <div className="grid gap-2 rounded-lg border border-line bg-surface p-4">
        <label className="flex items-start gap-2 text-sm font-bold text-ink">
          <input className="mt-0.5" name="privacyConsent" required type="checkbox" />
          개인정보 수집 및 이용에 동의합니다. (필수)
        </label>
        <label className="flex items-start gap-2 text-sm font-bold text-ink">
          <input className="mt-0.5" name="preliminaryAcknowledged" required type="checkbox" />
          이 신청은 예비 신청이며, 실제 계약은 별도로 체결됩니다. (필수)
        </label>
      </div>

      {fileError ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{fileError}</p> : null}
      {submitState.status === "error" ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{submitState.message}</p> : null}

      <button className="h-12 rounded-lg bg-ink px-4 text-sm font-black text-on-ink disabled:opacity-60" disabled={submitState.status === "submitting"} type="submit">
        {submitState.status === "submitting" ? "제출 중..." : "판매자 등록 신청서 제출"}
      </button>
    </form>
  );
}
