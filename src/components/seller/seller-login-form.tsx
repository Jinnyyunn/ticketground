"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginResponse = {
  readonly ok: boolean;
  readonly data?: { readonly mustChangePassword: boolean };
  readonly error?: { readonly message: string };
};

export function SellerLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/seller/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload: LoginResponse = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error?.message || "로그인에 실패했습니다.");
        return;
      }
      router.push("/seller/dashboard");
    } catch {
      setError("로그인 요청을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ticketground-container py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-ticket-2">
        <p className="text-sm font-black text-ticketground">기업 판매자</p>
        <h1 className="balanced-title mt-2 text-2xl font-black leading-tight text-ink">판매자 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">관리자로부터 발급받은 아이디와 임시 비밀번호로 로그인해 주세요.</p>
        <form className="mt-6 grid gap-3" noValidate onSubmit={submit}>
          <label className="grid gap-1 text-sm font-bold text-ink">
            아이디
            <input autoComplete="username" className="h-11 rounded-sm border border-line-strong bg-background px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30" name="username" type="text" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            비밀번호
            <input autoComplete="current-password" className="h-11 rounded-sm border border-line-strong bg-background px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30" name="password" type="password" />
          </label>
          {error ? <p aria-live="polite" className="text-sm font-bold text-ticketground">{error}</p> : null}
          <button className="mt-2 h-11 rounded-lg bg-ink text-sm font-black text-on-ink disabled:bg-surface-3 disabled:text-ink-4" disabled={submitting} type="submit">
            {submitting ? "로그인 중" : "로그인"}
          </button>
        </form>
      </div>
    </section>
  );
}
