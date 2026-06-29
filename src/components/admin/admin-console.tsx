"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  accountRows,
  initialLedgerRows,
  inventoryRows,
  panes,
  salesRows,
  venueBlocks,
  type AccountStatus,
  type LedgerRow,
  type PaneId,
  type SaleRow,
  type VenueKey,
} from "@/components/admin/admin-data";

const statusOptions: readonly AccountStatus[] = ["정상", "주의", "차단"];

function parseVenueKey(value: string): VenueKey {
  switch (value) {
    case "jamsil":
    case "kspo":
    case "nanji":
    case "blue":
      return value;
    default:
      return "jamsil";
  }
}

function parseAccountStatus(value: string): AccountStatus {
  switch (value) {
    case "정상":
    case "주의":
    case "차단":
      return value;
    default:
      return "주의";
  }
}

function nextLedger(rows: readonly LedgerRow[], event: string): LedgerRow {
  const last = rows[rows.length - 1];
  const seq = last ? last.seq + 1 : 10513;
  const prevHash = last?.hash ?? "0x00000000";
  return {
    seq,
    at: "10:12:00",
    prevHash,
    event,
    hash: `0x${(seq * 7919).toString(16).slice(0, 8)}`,
    valid: true,
  };
}

export function AdminConsole() {
  const [pane, setPane] = useState<PaneId>("ops");
  const [selectedSale, setSelectedSale] = useState<SaleRow>(salesRows[0]);
  const [saleTitle, setSaleTitle] = useState(salesRows[0].title);
  const [saleStatus, setSaleStatus] = useState(salesRows[0].status);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("감사 원장 정상");
  const [venue, setVenue] = useState<VenueKey>("jamsil");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(accountRows[1].status);
  const [qrHoldReleased, setQrHoldReleased] = useState(false);
  const [reply, setReply] = useState("공연 2시간 전 앱에서 동적 QR을 다시 확인해 주세요.");
  const [ledger, setLedger] = useState<readonly LedgerRow[]>(initialLedgerRows);

  const activeBlocks = useMemo(() => venueBlocks[venue], [venue]);

  function appendAudit(event: string) {
    setLedger((rows) => [...rows, nextLedger(rows, event)]);
    setToast(`원장 기록됨: ${event}`);
  }

  function pickSale(row: SaleRow) {
    setSelectedSale(row);
    setSaleTitle(row.title);
    setSaleStatus(row.status);
  }

  function confirmSaleSave() {
    setModalOpen(false);
    appendAudit(`sales.save ${selectedSale.id} ${saleStatus}`);
  }

  function changeAccountStatus(value: AccountStatus) {
    setAccountStatus(value);
    appendAudit(`account.status park-bulk ${value}`);
  }

  return (
    <main data-admin-console className="min-h-screen bg-[#090b10] text-white">
      <div className="grid min-h-screen lg:grid-cols-[232px_1fr]">
        <aside className="border-r border-white/10 bg-[#0d1118] p-5">
          <div className="text-[21px] font-black">Ticketground<span className="ml-1 text-[#ff2d3f]">●</span></div>
          <p className="mt-1 text-[13px] text-white/50">운영자 콘솔</p>
          <nav className="mt-8 grid gap-2" aria-label="관리자 메뉴">
            {panes.map((item) => (
              <button
                key={item.id}
                type="button"
                data-admin-menu={item.id}
                onClick={() => setPane(item.id)}
                className={`h-10 rounded-[8px] px-3 text-left text-[14px] font-bold focus-visible:ring-3 focus-visible:ring-[#ffe92e]/60 ${pane === item.id ? "bg-white text-[#0d1118]" : "text-white/70 hover:bg-white/10"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-10 rounded-[8px] border border-white/10 bg-white/5 p-3 text-[13px]">
            <p className="font-bold">운영자 이서준</p>
            <p className="mt-1 text-white/50">Audit role · Seoul</p>
          </div>
        </aside>

        <section className="min-w-0 bg-[#11151d]">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <p className="text-[13px] font-bold text-[#ffe92e]">Clean Ticket Admin</p>
              <h1 className="text-[26px] font-black">{panes.find((item) => item.id === pane)?.label}</h1>
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <span className="rounded-full border border-[#1f8a5b]/50 px-3 py-1 text-[#76d5ad]">{toast}</span>
              <Link href="/" className="rounded-[8px] border border-white/15 px-3 py-2 font-bold text-white/70 hover:bg-white/10">사용자 페이지</Link>
            </div>
          </header>

          <div className="p-6">
            {pane === "ops" && <OperationsPane />}
            {pane === "sales" && (
              <SalesPane
                selectedSale={selectedSale}
                saleTitle={saleTitle}
                saleStatus={saleStatus}
                onPickSale={pickSale}
                onTitleChange={setSaleTitle}
                onStatusChange={setSaleStatus}
                onSave={() => setModalOpen(true)}
              />
            )}
            {pane === "inventory" && <InventoryPane />}
            {pane === "map" && <MapPane venue={venue} blocks={activeBlocks} onVenueChange={setVenue} />}
            {pane === "accounts" && <AccountsPane accountStatus={accountStatus} onStatusChange={changeAccountStatus} />}
            {pane === "scalping" && <ScalpingPane />}
            {pane === "inquiries" && (
              <InquiryPane
                qrHoldReleased={qrHoldReleased}
                reply={reply}
                onReplyChange={setReply}
                onSend={() => appendAudit("inquiry.reply CTI-260710-entry")}
                onRelease={() => {
                  setQrHoldReleased(true);
                  appendAudit("qr-hold.release CTI-260710-entry");
                }}
              />
            )}
            {pane === "ledger" && <LedgerPane rows={ledger} />}
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 grid place-items-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label="판매 변경 저장 확인">
          <div className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#161b24] p-5 shadow-2xl">
            <h2 className="text-[22px] font-black">판매 변경 저장</h2>
            <p className="mt-3 text-[14px] text-white/65">{selectedSale.id} 변경을 감사 원장에 기록하고 저장합니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-[8px] border border-white/15 px-4 py-2 text-[14px] font-bold">취소</button>
              <button type="button" onClick={confirmSaleSave} className="rounded-[8px] bg-[#ff2d3f] px-4 py-2 text-[14px] font-black">저장 확인</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5"><h2 className="text-[20px] font-black">{title}</h2><div className="mt-4">{children}</div></section>;
}

function OperationsPane() {
  return <div className="grid gap-4"><div className="grid gap-3 md:grid-cols-5">{["판매중 좌석 12,842", "재판매 풀 318", "대기 문의 24", "주의 계정 17", "원장 10,515"].map((item) => <div key={item} className="rounded-[8px] bg-white/8 p-4 text-[14px] font-black">{item}</div>)}</div><Panel title="최근 거래"><Rows rows={["CTI-260513-A4F2K9 · VIP H-14 · 결제완료", "POOL-4421 · 랜덤매칭 · 원장 검증", "TRF-1088 · 동반자 양도 요청"]} /></Panel></div>;
}

function SalesPane(props: { readonly selectedSale: SaleRow; readonly saleTitle: string; readonly saleStatus: string; readonly onPickSale: (row: SaleRow) => void; readonly onTitleChange: (value: string) => void; readonly onStatusChange: (value: string) => void; readonly onSave: () => void }) {
  return <div className="grid gap-4 xl:grid-cols-[1fr_360px]"><Panel title="공연 목록"><div className="grid gap-2">{salesRows.map((row) => <button key={row.id} type="button" onClick={() => props.onPickSale(row)} className={`rounded-[8px] border p-3 text-left text-[14px] ${props.selectedSale.id === row.id ? "border-[#ffe92e] bg-[#ffe92e]/10" : "border-white/10 bg-black/20"}`}><b>{row.title}</b><span className="block text-white/55">{row.venue} · {row.openAt}</span></button>)}</div></Panel><Panel title="판매 폼"><label className="text-[13px] text-white/60">공연명<input value={props.saleTitle} onChange={(event) => props.onTitleChange(event.target.value)} className="mt-1 w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-white" /></label><label className="mt-3 block text-[13px] text-white/60">상태<input value={props.saleStatus} onChange={(event) => props.onStatusChange(event.target.value)} className="mt-1 w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-white" /></label><button type="button" onClick={props.onSave} className="mt-4 w-full rounded-[8px] bg-[#ff2d3f] px-4 py-3 text-[14px] font-black">저장</button></Panel></div>;
}

function InventoryPane() {
  return <Panel title="소유 좌석 잠금"><div className="grid gap-2">{inventoryRows.map((row) => <div key={row.zone} className="grid grid-cols-[1fr_90px_120px] items-center gap-3 rounded-[8px] bg-black/20 p-3 text-[14px]"><span>{row.zone} · {row.sold}/{row.total}</span><span className="text-white/55">{row.owner ?? "소유자 없음"}</span><button type="button" disabled={row.owner === null} className="rounded-[8px] border border-white/15 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-35">잠금 전환</button></div>)}</div></Panel>;
}

function MapPane(props: { readonly venue: VenueKey; readonly blocks: readonly string[]; readonly onVenueChange: (value: VenueKey) => void }) {
  return <Panel title="공연장별 좌석도"><select value={props.venue} onChange={(event) => props.onVenueChange(parseVenueKey(event.target.value))} className="rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-[14px]"><option value="jamsil">잠실</option><option value="kspo">KSPO</option><option value="nanji">난지</option><option value="blue">블루스퀘어</option></select><div className="mt-5 grid grid-cols-3 gap-3">{props.blocks.map((block) => <button key={block} type="button" className="aspect-[1.8] rounded-[8px] border border-[#1a47ff]/40 bg-[#1a47ff]/15 text-[15px] font-black">{block}</button>)}</div></Panel>;
}

function AccountsPane(props: { readonly accountStatus: AccountStatus; readonly onStatusChange: (value: AccountStatus) => void }) {
  return <Panel title="신뢰 점수"><div className="grid gap-3">{accountRows.map((row) => <div key={row.id} className="rounded-[8px] bg-black/20 p-3 text-[14px]"><div className="flex items-center justify-between"><b>{row.name}</b><span>{row.trust}점</span></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className={`h-2 rounded-full bg-[#1f8a5b] ${row.trustClass}`} /></div>{row.id === "park-bulk" && <select value={props.accountStatus} onChange={(event) => props.onStatusChange(parseAccountStatus(event.target.value))} className="mt-3 rounded-[8px] border border-white/10 bg-black/30 px-3 py-2">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>}</div>)}</div></Panel>;
}

function ScalpingPane() {
  return <div className="grid gap-4 md:grid-cols-2"><Panel title="지정양도 차단"><Rows rows={["외부 링크 포함 양도 요청 차단", "동일 IP 18회 반복 등록 제한", "좌석번호 직접 거래 문구 보류"]} /></Panel><Panel title="매크로 신호"><Rows rows={["클릭 간격 42ms · 위험 91%", "동일 결제수단 7계정 · 위험 78%", "대기열 새로고침 31회 · 위험 66%"]} /></Panel></div>;
}

function InquiryPane(props: { readonly qrHoldReleased: boolean; readonly reply: string; readonly onReplyChange: (value: string) => void; readonly onSend: () => void; readonly onRelease: () => void }) {
  return <Panel title="입장 QR 문의"><div className="rounded-[8px] bg-black/20 p-3 text-[14px] text-white/70">CTI-260710-entry · QR 준비 상태 지속 · 우선응대</div><textarea value={props.reply} onChange={(event) => props.onReplyChange(event.target.value)} className="mt-3 min-h-24 w-full rounded-[8px] border border-white/10 bg-black/30 p-3 text-[14px]" /><div className="mt-3 flex gap-2"><button type="button" onClick={props.onSend} className="rounded-[8px] bg-white px-4 py-2 text-[14px] font-black text-[#11151d]">답변 등록</button><button type="button" onClick={props.onRelease} className="rounded-[8px] border border-[#ffe92e]/50 px-4 py-2 text-[14px] font-bold text-[#ffe92e]">{props.qrHoldReleased ? "QR 보류 해제됨" : "QR 보류 해제"}</button></div></Panel>;
}

function LedgerPane({ rows }: { readonly rows: readonly LedgerRow[] }) {
  return <Panel title="append-only hash chain"><div className="grid gap-2">{rows.map((row) => <div key={row.seq} className="ledger-row grid gap-2 rounded-[8px] border border-white/10 bg-black/25 p-3 text-[13px] md:grid-cols-[80px_90px_1fr_120px_70px]"><b>SEQ {row.seq}</b><span>{row.at}</span><span>PREV {row.prevHash} · {row.event}</span><code>{row.hash}</code><b className="text-[#76d5ad]">{row.valid ? "✓ valid" : "invalid"}</b></div>)}</div></Panel>;
}

function Rows({ rows }: { readonly rows: readonly string[] }) {
  return <div className="grid gap-2">{rows.map((row) => <div key={row} className="rounded-[8px] bg-black/20 p-3 text-[14px] text-white/70">{row}</div>)}</div>;
}
