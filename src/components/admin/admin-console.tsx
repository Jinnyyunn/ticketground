"use client";

import Link from "next/link";
import { KeyRound, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { WorkspaceContent } from "./admin-workspaces";
import { Field, WorkspacePanel, valueFromForm } from "./console-primitives";
import { hasPermission, workspaceDefinitions, type AdminSession, type Feedback, type WorkspaceData } from "./console-types";
import type { WorkspaceKey } from "./console-workspaces";

type ApiResult<T> = { readonly ok: boolean; readonly data?: T; readonly error?: { readonly message: string } };
type InventoryFilters = { readonly eventId?: string; readonly performanceDateId?: string; readonly zoneId?: string; readonly page?: number };
type FinanceFilters = { readonly eventId?: string; readonly from?: string; readonly method?: string; readonly status?: string; readonly to?: string; readonly page?: number };
type AuditFilters = { readonly action?: string; readonly actorId?: string; readonly from?: string; readonly to?: string; readonly page?: number };
type AccountFilters = { readonly search?: string };
type SupportFilters = { readonly category?: string; readonly status?: string };
type GroupBookingFilters = { readonly status?: string; readonly page?: number };

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const payload: ApiResult<T> = await response.json();
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message || `${path} 요청 실패`);
  return payload.data;
}

function AdminLogin({ error, onSubmit }: { readonly error: string; readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10"><form className="w-full max-w-md rounded-lg border border-line bg-background p-6" onSubmit={onSubmit}><div className="flex items-center gap-2 text-ink"><KeyRound size={20} /><h1 className="text-2xl font-black">Ticketground Admin</h1></div><p className="mt-3 text-sm leading-relaxed text-ink-3">브라우저 세션으로 운영 콘솔에 로그인합니다.</p><div className="mt-5 grid gap-3"><Field label="관리자 아이디" name="username" /><Field label="비밀번호" name="password" type="password" /></div>{error ? <p aria-live="polite" className="mt-4 rounded-lg border border-ticketground px-3 py-2 text-sm font-bold text-ticketground">{error}</p> : null}<button className="mt-5 h-11 w-full rounded-lg bg-ink px-4 text-sm font-black text-on-ink" type="submit">로그인</button></form></main>;
}

function WorkspaceNavigation({ close, session, workspace }: { readonly close: () => void; readonly session: AdminSession; readonly workspace: WorkspaceKey }) {
  return <nav aria-label="운영 작업공간" className="grid gap-1">{Object.entries(workspaceDefinitions).map(([key, item]) => {
    const menuWorkspace = key as WorkspaceKey;
    if (!hasPermission(session, item.permission)) return null;
    const Icon = item.Icon;
    const active = menuWorkspace === workspace;
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-black no-underline ${active ? "bg-ink text-on-ink" : "text-ink hover:bg-surface"}`} href={menuWorkspace === "overview" ? "/console" : `/console/${menuWorkspace}`} key={menuWorkspace} onClick={close}><Icon size={17} />{item.label}</Link>;
  })}</nav>;
}

export function AdminConsolePage({ workspace = "overview" }: { readonly workspace?: WorkspaceKey }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [inventoryFilters, setInventoryFilters] = useState<InventoryFilters>({});
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>({});
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
  const [accountFilters, setAccountFilters] = useState<AccountFilters>({});
  const [supportFilters, setSupportFilters] = useState<SupportFilters>({});
  const [groupBookingFilters, setGroupBookingFilters] = useState<GroupBookingFilters>({});
  const definition = workspaceDefinitions[workspace];
  const canAccess = hasPermission(session, definition.permission);
  const closeMenu = (): void => setMenuOpen(false);

  const refreshWorkspace = useCallback(async (activeSession: AdminSession): Promise<void> => {
    if (!hasPermission(activeSession, workspaceDefinitions[workspace].permission)) {
      setData(null);
      return;
    }
    const params = new URLSearchParams();
    if (selectedEventId && (workspace === "catalog" || workspace === "sales")) params.set("eventId", selectedEventId);
    if (workspace === "inventory") {
      if (inventoryFilters.eventId) params.set("eventId", inventoryFilters.eventId);
      if (inventoryFilters.performanceDateId) params.set("performanceDateId", inventoryFilters.performanceDateId);
      if (inventoryFilters.zoneId) params.set("zoneId", inventoryFilters.zoneId);
      if (inventoryFilters.page) params.set("page", String(inventoryFilters.page));
      params.set("limit", "50");
    }
    if (workspace === "finance") {
      if (financeFilters.eventId) params.set("eventId", financeFilters.eventId);
      if (financeFilters.from) params.set("from", financeFilters.from);
      if (financeFilters.method) params.set("method", financeFilters.method);
      if (financeFilters.status) params.set("status", financeFilters.status);
      if (financeFilters.to) params.set("to", financeFilters.to);
      if (financeFilters.page) params.set("page", String(financeFilters.page));
      params.set("limit", "50");
    }
    if (workspace === "accounts" && accountFilters.search) params.set("search", accountFilters.search);
    if (workspace === "support") {
      if (supportFilters.category) params.set("category", supportFilters.category);
      if (supportFilters.status) params.set("status", supportFilters.status);
    }
    if (workspace === "audit") {
      if (auditFilters.action) params.set("action", auditFilters.action);
      if (auditFilters.actorId) params.set("actorId", auditFilters.actorId);
      if (auditFilters.from) params.set("from", auditFilters.from);
      if (auditFilters.to) params.set("to", auditFilters.to);
      if (auditFilters.page) params.set("page", String(auditFilters.page));
      params.set("limit", "50");
    }
    if (workspace === "group-booking") {
      if (groupBookingFilters.status) params.set("status", groupBookingFilters.status);
      if (groupBookingFilters.page) params.set("page", String(groupBookingFilters.page));
      params.set("limit", "50");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    setData(await apiRequest<WorkspaceData>(`/api/admin/workspaces/${workspace}${query}`));
  }, [accountFilters, auditFilters, financeFilters, groupBookingFilters, inventoryFilters, selectedEventId, supportFilters, workspace]);

  useEffect(() => {
    apiRequest<AdminSession>("/api/admin/session").then(async (activeSession) => { setSession(activeSession); await refreshWorkspace(activeSession); }).catch(() => setSession(null)).finally(() => setLoading(false));
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === "Escape") closeMenu(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const setLocalError = (message: string): void => setFeedback({ tone: "error", message });
  const updateInventoryFilters = (nextFilters: InventoryFilters): void => {
    setFeedback(null);
    setInventoryFilters(nextFilters);
  };
  const updateFinanceFilters = (nextFilters: FinanceFilters): void => {
    setFeedback(null);
    setFinanceFilters(nextFilters);
  };
  const updateAuditFilters = (nextFilters: AuditFilters): void => {
    setFeedback(null);
    setAuditFilters(nextFilters);
  };
  const updateAccountFilters = (nextFilters: AccountFilters): void => {
    setFeedback(null);
    setAccountFilters(nextFilters);
  };
  const updateSupportFilters = (nextFilters: SupportFilters): void => {
    setFeedback(null);
    setSupportFilters(nextFilters);
  };
  const updateGroupBookingFilters = (nextFilters: GroupBookingFilters): void => {
    setFeedback(null);
    setGroupBookingFilters(nextFilters);
  };

  const mutate = async (path: string, body: Record<string, unknown>, success: string): Promise<boolean> => {
    if (!session) return false;
    setFeedback(null);
    try {
      await apiRequest<unknown>(path, { method: "POST", body: JSON.stringify(body), headers: { "x-tig-csrf": session.csrf } });
      await refreshWorkspace(session);
      if (success) setFeedback({ tone: "success", message: success });
      return true;
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "작업을 완료하지 못했습니다." });
      return false;
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    setLoginError("");
    try {
      const activeSession = await apiRequest<AdminSession>("/api/admin/login", { method: "POST", body: JSON.stringify({ username: valueFromForm(form, "username"), password: valueFromForm(form, "password") }) });
      setSession(activeSession);
      await refreshWorkspace(activeSession);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    }
  };

  const handleLogout = async (): Promise<void> => {
    if (!session) return;
    try {
      await apiRequest<unknown>("/api/admin/logout", { method: "POST", body: JSON.stringify({}), headers: { "x-tig-csrf": session.csrf } });
      setData(null);
      setSession(null);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "로그아웃에 실패했습니다." });
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-surface px-5 text-sm font-black text-ink">운영 콘솔을 확인하는 중입니다.</main>;
  if (!session) return <AdminLogin error={loginError} onSubmit={handleLogin} />;

  return <main className="min-h-screen bg-surface text-ink"><header className="sticky top-0 z-30 border-b border-line bg-background"><div className="flex min-h-14 items-center justify-between gap-3 px-4"><div className="flex min-w-0 items-center gap-2"><button aria-controls="console-menu" aria-expanded={menuOpen} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-background md:hidden" onClick={() => setMenuOpen(true)} type="button"><Menu aria-hidden="true" size={18} /><span className="sr-only">메뉴 열기</span></button><div className="min-w-0"><p className="truncate text-xs font-bold text-ink-3">Ticketground Admin</p><h1 className="truncate text-lg font-black">{definition.heading}</h1></div></div><div className="flex items-center gap-3"><p className="hidden text-xs font-bold text-ink-3 sm:block">{session.admin.username} · {session.admin.roles.map((role) => role.name).join(", ")}</p><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-background px-3 text-sm font-black" onClick={handleLogout} type="button"><LogOut size={16} />로그아웃</button></div></div></header>{menuOpen ? <div className="fixed inset-0 z-40 bg-scrim/40 md:hidden" onClick={closeMenu}><aside aria-label="모바일 운영 메뉴" className="h-full w-72 border-r border-line bg-background p-4" id="console-menu" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><strong className="text-base font-black">작업공간</strong><button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line" onClick={closeMenu} type="button"><X aria-hidden="true" size={18} /><span className="sr-only">메뉴 닫기</span></button></div><WorkspaceNavigation close={closeMenu} session={session} workspace={workspace} /></aside></div> : null}<div className="mx-auto grid max-w-[1440px] md:grid-cols-[224px_minmax(0,1fr)]"><aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] border-r border-line bg-background p-4 md:block"><p className="mb-3 px-3 text-xs font-black text-ink-3">작업공간</p><WorkspaceNavigation close={closeMenu} session={session} workspace={workspace} /></aside><section className="min-w-0 p-4 sm:p-5"><div className="mb-4"><p className="text-sm font-bold text-ink-3">{definition.description}</p></div>{!canAccess ? <WorkspacePanel><div className="flex gap-3"><ShieldCheck className="shrink-0 text-warn" size={20} /><div><h2 className="text-lg font-black">접근 권한이 없습니다.</h2><p className="mt-1 text-sm font-bold text-ink-3">이 작업공간에는 {definition.permission} 권한이 필요합니다. 데이터는 요청하지 않았습니다.</p></div></div></WorkspacePanel> : <WorkspaceContent data={data} feedback={feedback} mutate={mutate} onAccountFilterChange={updateAccountFilters} onAuditFilterChange={updateAuditFilters} onFinanceFilterChange={updateFinanceFilters} onGroupBookingFilterChange={updateGroupBookingFilters} onInventoryFilterChange={updateInventoryFilters} onLocalError={setLocalError} onSelectEvent={setSelectedEventId} onSupportFilterChange={updateSupportFilters} session={session} workspace={workspace} />}</section></div></main>;
}
