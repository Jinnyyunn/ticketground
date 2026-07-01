"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { DEMO_USER_ID, getSession, type ApiSession, updateProfile } from "@/lib/ticketground-api";

type LoginMode = "login" | "signup";

const socialProviders = [
  { label: "카카오로 계속하기", tone: "bg-[#FEE500] text-ink" },
  { label: "네이버로 계속하기", tone: "bg-[#03C75A] text-white" },
  { label: "Apple로 계속하기", tone: "bg-ink text-white" },
] as const;

const perks = ["공식 재판매 풀", "동적 QR 입장", "예매 내역 통합 관리"] as const;

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [session, setSession] = useState<ApiSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [status, setStatus] = useState("세션 확인 대기");
  const [saving, setSaving] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const canLogin = email.trim().length > 3 && password.length > 3;
  const canSignup = canLogin && name.trim().length > 1 && identityChecked && termsChecked;

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setProfileName(nextSession.name);
        setStatus(`${nextSession.name} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "세션을 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveProfile() {
    const nextName = profileName.trim();
    if (!nextName) return;
    setSaving(true);
    setStatus("프로필 저장 중");
    try {
      const nextSession = await updateProfile(nextName);
      setSession(nextSession);
      setProfileName(nextSession.name);
      setStatus(`${nextSession.name} 프로필 저장 완료`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ticketground-container py-10">
      <div className="grid overflow-hidden rounded-[20px] border border-line bg-white shadow-ticket-2 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="flex min-h-[560px] flex-col gap-8 bg-ink p-8 text-white lg:p-10">
          <div>
            <p className="text-sm font-black text-accent-2">Ticketground Members</p>
            <h1 className="balanced-title mt-4 text-[31px] font-black leading-tight sm:text-[37px]">
              클린 티켓 예매와
              <br />
              환불 관리를 한 계정에서
            </h1>
            <p className="mt-5 max-w-[360px] text-sm leading-loose text-white/70">
              데모 계정으로 계정 상태와 프로필 갱신을 확인합니다. 실제 소셜 인증은 별도 인증 제공자 연동 전까지 데모 계정으로 동작합니다.
            </p>
          </div>

          <div className="grid gap-3 rounded-[12px] bg-white/8 p-5">
            <p className="text-sm font-black text-white">회원 기능 미리보기</p>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[12px] text-white/55">예매번호</dt>
                <dd className="mt-1 text-sm font-black">CTI</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">QR</dt>
                <dd className="mt-1 text-sm font-black">20초</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">재판매</dt>
                <dd className="mt-1 text-sm font-black">공식</dd>
              </div>
            </dl>
          </div>

          <ul className="mt-auto grid gap-3 text-sm font-bold text-white/80">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <span className="h-px w-6 bg-accent-2" aria-hidden />
                {perk}
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-5 flex justify-end">
            <Link
              href="/"
              aria-label="메인 홈으로 이동"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-line bg-white px-3 text-sm font-black text-ink transition hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Home className="size-4" aria-hidden="true" />
              <span>홈</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 rounded-[10px] bg-surface p-1" role="tablist" aria-label="로그인 회원가입 전환">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`h-11 rounded-[8px] text-sm font-black transition ${mode === "login" ? "bg-white text-ink shadow-ticket-1" : "text-ink-3"}`}
              onClick={() => setMode("login")}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`h-11 rounded-[8px] text-sm font-black transition ${mode === "signup" ? "bg-white text-ink shadow-ticket-1" : "text-ink-3"}`}
              onClick={() => setMode("signup")}
            >
              회원가입
            </button>
          </div>

          <div className="mt-8">
            <p className="text-sm font-black text-ticketground">{mode === "login" ? "로그인" : "회원가입"}</p>
            <h2 className="balanced-title mt-2 text-[24px] font-black leading-tight text-ink sm:text-[28px]">
              {mode === "login" ? "예매 내역을 확인해 주세요" : "본인 확인 후 가입을 진행해 주세요"}
            </h2>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              {mode === "login"
                ? `데모 사용자 ${DEMO_USER_ID}의 세션 상태를 함께 확인합니다.`
                : "가입 전용 본인인증과 약관 동의 블록을 포함한 데모 가입 화면입니다."}
            </p>
          </div>

          <div className="mt-5 rounded-[10px] border border-line bg-surface p-4" aria-live="polite">
            <p className="text-sm font-black text-ink">세션 상태</p>
            <p className="mt-1 text-sm font-bold text-ink-3">{status}</p>
            {session && (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-black text-ink">
                  닉네임
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    maxLength={12}
                    className="h-11 rounded-[8px] border border-line-strong bg-white px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || !profileName.trim()}
                  onClick={saveProfile}
                  className="h-11 self-end rounded-[8px] bg-ink px-4 text-sm font-black text-white disabled:bg-surface-3 disabled:text-ink-4"
                >
                  {saving ? "저장 중" : "프로필 저장"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-7 grid gap-3">
            {socialProviders.map((provider) => (
              <button key={provider.label} type="button" className={`h-12 rounded-[8px] text-[15px] font-black ${provider.tone}`}>
                {provider.label}
              </button>
            ))}
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-bold text-ink-4">
            <span className="h-px flex-1 bg-line" aria-hidden />
            이메일 mock 입력
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>

          <div className="grid gap-4">
            {mode === "signup" && (
              <label className="grid gap-2 text-sm font-black text-ink">
                이름
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  placeholder="홍길동"
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-black text-ink">
              이메일
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                placeholder="qa@ticketground.kr"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                placeholder="mock password"
              />
            </label>
          </div>

          {mode === "signup" && (
            <div className="signup-only mt-5 grid gap-3">
              <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  checked={identityChecked}
                  onChange={(event) => setIdentityChecked(event.target.checked)}
                  className="mt-1 accent-[#1a47ff]"
                />
                <span>
                  <strong className="block text-ink">본인인증 완료</strong>
                  휴대폰 본인확인과 기기 확인을 완료한 것으로 처리하는 mock 블록입니다.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(event) => setTermsChecked(event.target.checked)}
                  className="mt-1 accent-[#1a47ff]"
                />
                <span>
                  <strong className="block text-ink">필수 약관 동의</strong>
                  이용약관, 개인정보 처리, 클린티켓 정책 안내를 확인했습니다.
                </span>
              </label>
            </div>
          )}

          <button
            type="button"
            disabled={mode === "login" ? !canLogin : !canSignup}
            className="mt-6 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-black text-white transition enabled:hover:bg-ticketground/90 disabled:bg-surface-3 disabled:text-ink-4"
          >
            {mode === "login" ? "mock 로그인 확인" : "mock 회원가입 완료"}
          </button>
        </div>
      </div>
    </section>
  );
}
