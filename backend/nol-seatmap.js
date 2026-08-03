import { createBoundedTtlCache } from "./bounded-cache.js";

// NOL(야놀자) 티켓 좌석 배치도 API 연동
// -----------------------------------------------------------------------------
// 좌석 "배치도 조회"만 사용한다. 좌석 선점(preselect / reserved)은 여기서 다루지 않는다.
//
//   GET /onestop/api/seats/block-data ... 구역 목록 + 도면 좌표
//   GET /onestop/api/seatMeta         ... 좌석별 좌표/등급/가격
//   GET /onestop/api/seatStatus       ... 좌석 판매상태 hex 비트맵 (비트 1 = 예매가능)
//   GET /onestop/api/seats/grades     ... 등급별 가격/잔여
//
// 위 4개는 로그인 세션 없이 호출된다. 공연장 계열(A/B)과 무관하게 동일하게 응답한다.

const ONESTOP = "https://tickets.interpark.com/onestop/api";
const GATE = "https://tickets.interpark.com/api/ticket/v2/reserve-gate";
const BIZ_CODE = "61776"; // NOL 제휴사 코드

// NOL 은 "남의 공연" 판매상태라서 우리 서비스의 실제 재고와 무관하다.
// ticketground 자체 예매분이 아직 없으므로 기본값은 "도면만 빌려오고 전 좌석 예매가능".
// NOL 의 실시간 판매상태를 그대로 보고 싶으면 NOL_USE_LIVE_SEAT_STATUS=1 로 켠다.
const USE_LIVE_SEAT_STATUS = process.env.NOL_USE_LIVE_SEAT_STATUS === "1";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
  "X-Onestop-Channel": "NOL",
  "X-Ticket-BFF-Language": "KO",
  Referer: "https://tickets.interpark.com/onestop/seat"
};

// X-OneStop-Trace-ID 는 필수 헤더다. 없으면 400 이 떨어진다.
function traceId() {
  const pool = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 16; i += 1) out += pool[Math.floor(Math.random() * pool.length)];
  return out;
}

// ticketground venueId -> NOL 공연장(placeCode) + 좌석도면을 읽어올 대표 goodsCode
// placeCode 는 "좌석 배치" 단위 코드라서 같은 홀도 배치가 다르면 코드가 갈린다.
export const NOL_VENUE_MAP = {
  venue_bluesquare: { goodsCode: "26009314", placeCode: "26000011", label: "블루스퀘어 우리은행홀" },
  venue_bluesquare_shinhan_card_hall: { goodsCode: "26008194", placeCode: "26000641", label: "블루스퀘어 우리WON뱅킹홀" },
  venue_bluesquare_nemo: { goodsCode: "26008194", placeCode: "26000641", label: "블루스퀘어 우리WON뱅킹홀" },
  venue_lg_arts_center_seoul_lg_signature_hall: { goodsCode: "L0000142", placeCode: "L0000001", label: "LG아트센터 서울 LG SIGNATURE 홀" },
  venue_sejong_grand_theater: { goodsCode: "P0004669", placeCode: "P1001005", label: "세종문화회관 대극장" },
  venue_sejong_center: { goodsCode: "P0004669", placeCode: "P1001005", label: "세종문화회관 대극장" },
  venue_lotte_concert_hall: { goodsCode: "26006406", placeCode: "24000649", label: "롯데콘서트홀" },
  venue_kintex_hall_9: { goodsCode: "26004771", placeCode: "26000326", label: "킨텍스 제2전시장 9홀" },
  venue_seoul_arts_center_concert_hall: { goodsCode: "26010230", placeCode: "25001214", label: "예술의전당 콘서트홀" },
  venue_tongyeong_concert_hall: { goodsCode: "26010841", placeCode: "25001704", label: "통영국제음악당 콘서트홀" },
  venue_daehakro_arts_theater: { goodsCode: "26006189", placeCode: "25000912", label: "대학로 TOM 1관" }
};

const META_TTL_MS = 10 * 60 * 1000; // 좌석 좌표/등급은 잘 안 변한다
const STATUS_TTL_MS = 20 * 1000; // 잔여석은 짧게
const SEQ_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;
const BLOCK_FETCH_CONCURRENCY = 4;

const cache = createBoundedTtlCache({ maxEntries: MAX_CACHE_ENTRIES });

function fromCache(key, ttl) {
  return cache.get(key, ttl);
}

function putCache(key, value) {
  return cache.set(key, value);
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function getJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, "X-OneStop-Trace-ID": traceId() },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`NOL_HTTP_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// hex 비트맵 -> "010110..." (비트 i 가 seats[i] 에 1:1 대응, 1 = 예매가능)
function toBits(hex) {
  let out = "";
  for (const ch of String(hex || "")) {
    out += parseInt(ch, 16).toString(2).padStart(4, "0");
  }
  return out;
}

function toDate(stamp) {
  if (!stamp || stamp.length < 12) return null;
  return new Date(
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:00+09:00`
  );
}

// 회차(playSeq)는 상시 바뀐다. 지금 판매중인 회차를 골라 캐시한다.
export async function resolvePlaySeq(goodsCode, placeCode) {
  const key = `seq:${goodsCode}:${placeCode}`;
  const cached = fromCache(key, SEQ_TTL_MS);
  if (cached) return cached;

  const url = `${GATE}/goods-info?bizCode=${BIZ_CODE}&goodsCode=${goodsCode}&lang=ko&passCode=&placeCode=${placeCode}&nc=${Date.now()}`;
  const info = await getJson(url);
  const now = new Date();
  const list = Array.isArray(info.playSeqList) ? info.playSeqList : [];
  const sellable = list.filter((item) => {
    const open = toDate(item.saleOpenTime);
    const close = toDate(item.saleCloseTime);
    return open && close && open <= now && now <= close;
  });
  const picked = sellable[0] || list[list.length - 1];
  if (!picked) throw new Error("NOL_NO_PLAY_SEQ");

  return putCache(key, {
    playSeq: picked.playSeq,
    playDate: picked.playDate,
    playTime: picked.playTime,
    placeName: info.placeName,
    goodsName: info.goodsName,
    sellableCount: sellable.length
  });
}

async function fetchGrades(goodsCode, placeCode, playSeq) {
  const key = `grades:${goodsCode}:${placeCode}:${playSeq}`;
  const cached = fromCache(key, STATUS_TTL_MS);
  if (cached) return cached;
  try {
    const rows = await getJson(
      `${ONESTOP}/seats/grades?goodsCode=${goodsCode}&placeCode=${placeCode}&playSeq=${playSeq}&bizCode=${BIZ_CODE}`
    );
    return putCache(key, Array.isArray(rows) ? rows : []);
  } catch {
    // 레거시(B계열) 공연장은 grades 가 500 을 내려주기도 한다. seatMeta 로 대체 집계한다.
    return putCache(key, []);
  }
}

async function fetchBlocks(goodsCode, placeCode, playSeq) {
  const key = `blocks:${goodsCode}:${placeCode}:${playSeq}`;
  const cached = fromCache(key, META_TTL_MS);
  if (cached) return cached;
  const rows = await getJson(
    `${ONESTOP}/seats/block-data?goodsCode=${goodsCode}&placeCode=${placeCode}&playSeq=${playSeq}`
  );
  return putCache(key, Array.isArray(rows) ? rows : []);
}

async function fetchBlockSeats(goodsCode, placeCode, playSeq, blockKey) {
  const key = `meta:${goodsCode}:${placeCode}:${playSeq}:${blockKey}`;
  const cached = fromCache(key, META_TTL_MS);
  if (cached) return cached;
  const query = `goodsCode=${goodsCode}&placeCode=${placeCode}&playSeq=${playSeq}&bizCode=${BIZ_CODE}&blockKeys=${encodeURIComponent(blockKey)}`;
  const rows = await getJson(`${ONESTOP}/seatMeta?${query}`);
  return putCache(key, rows?.[0]?.seats || []);
}

async function fetchBlockStatus(goodsCode, placeCode, playSeq, blockKey) {
  const key = `status:${goodsCode}:${placeCode}:${playSeq}:${blockKey}`;
  const cached = fromCache(key, STATUS_TTL_MS);
  if (cached) return cached;
  const query = `goodsCode=${goodsCode}&placeCode=${placeCode}&playSeq=${playSeq}&bizCode=${BIZ_CODE}&blockKeys=${encodeURIComponent(blockKey)}`;
  const body = await getJson(`${ONESTOP}/seatStatus?${query}`);
  return putCache(key, toBits(body?.data?.[0]));
}

/**
 * NOL 좌석 배치도를 ticketground 좌석맵 형태(zones/seats)로 변환해 돌려준다.
 */
export async function fetchNolSeatMap({ goodsCode, placeCode, playSeq }) {
  const seq = playSeq || (await resolvePlaySeq(goodsCode, placeCode)).playSeq;
  const [blocks, gradeRows] = await Promise.all([
    fetchBlocks(goodsCode, placeCode, seq),
    fetchGrades(goodsCode, placeCode, seq)
  ]);
  if (!blocks.length) throw new Error("NOL_NO_BLOCKS");

  // 전체 도면 경계 -> 0~100 정규화 (ticketground mapPosition 좌표계)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const block of blocks) {
    minX = Math.min(minX, block.absoluteLeft);
    minY = Math.min(minY, block.absoluteTop);
    maxX = Math.max(maxX, block.absoluteRight);
    maxY = Math.max(maxY, block.absoluteBottom);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const normX = (value) => Number((((value - minX) / spanX) * 96 + 2).toFixed(2));
  const normY = (value) => Number((((value - minY) / spanY) * 96 + 2).toFixed(2));

  const blockPayloads = await mapWithConcurrency(blocks, BLOCK_FETCH_CONCURRENCY, async (block) => {
    const meta = await fetchBlockSeats(goodsCode, placeCode, seq, block.blockKey);
    const bits = USE_LIVE_SEAT_STATUS
      ? await fetchBlockStatus(goodsCode, placeCode, seq, block.blockKey)
      : null;
    return { block, meta, bits };
  });

  const seats = [];
  const gradeAgg = new Map();

  for (const { block, meta, bits } of blockPayloads) {
    meta.forEach((seat, index) => {
      if (!seat.isExposable) return; // 통로/미판매 칸
      const soldOutOnNol = bits ? bits[index] !== "1" : false;
      const available = USE_LIVE_SEAT_STATUS ? !soldOutOnNol : true;
      const gradeId = seat.seatGrade ? `nol_grade_${seat.seatGrade}` : "nol_grade_etc";
      const gradeName = seat.seatGradeName || "일반석";
      const entry = gradeAgg.get(gradeId) || {
        id: gradeId,
        name: gradeName,
        price: seat.salesPrice || 0,
        available: 0,
        total: 0
      };
      entry.total += 1;
      if (available) entry.available += 1;
      if (!entry.price && seat.salesPrice) entry.price = seat.salesPrice;
      gradeAgg.set(gradeId, entry);

      const label = [seat.floor, seat.rowNo, `${seat.seatNo}번`].filter(Boolean).join(" ").trim();
      seats.push({
        id: seat.seatInfoId,
        label: `${seat.seatNo}`,
        displayCode: label || `${seat.seatNo}`,
        zoneId: gradeId,
        zoneName: gradeName,
        price: seat.salesPrice || 0,
        status: available ? "ON_SALE" : "SOLD_OUT",
        available,
        mapPosition: {
          x: normX(seat.posLeft),
          y: normY(seat.posTop),
          width: 1.2,
          height: 1.6,
          rotate: 0,
          shape: "actual-map"
        },
        // 참고용 원본 필드 (선점 API 붙일 때 그대로 필요한 값들)
        nol: {
          blockKey: block.blockKey,
          seatInfoId: seat.seatInfoId,
          seatGrade: seat.seatGrade,
          soldOutOnNol,
          floor: seat.floor,
          rowNo: seat.rowNo,
          seatNo: seat.seatNo
        }
      });
    });
  }

  const zones = gradeRows.length
    ? gradeRows.map((row) => {
        const agg = gradeAgg.get(`nol_grade_${row.seatGrade}`);
        return {
          id: `nol_grade_${row.seatGrade}`,
          name: row.seatGradeName,
          price: row.salesPrice || agg?.price || 0,
          available: USE_LIVE_SEAT_STATUS
            ? typeof row.remainCount === "number"
              ? row.remainCount
              : agg?.available || 0
            : agg?.available || 0,
          color: row.salesColor || null
        };
      })
    : [...gradeAgg.values()].sort((a, b) => a.id.localeCompare(b.id));

  return {
    source: {
      provider: "NOL(인터파크 onestop)",
      endpoints: [
        `GET ${ONESTOP}/seats/block-data?goodsCode&placeCode&playSeq`,
        `GET ${ONESTOP}/seatMeta?goodsCode&placeCode&playSeq&blockKeys&bizCode`,
        ...(USE_LIVE_SEAT_STATUS
          ? [`GET ${ONESTOP}/seatStatus?goodsCode&placeCode&playSeq&blockKeys&bizCode`]
          : []),
        `GET ${ONESTOP}/seats/grades?goodsCode&placeCode&playSeq&bizCode`
      ],
      goodsCode,
      placeCode,
      playSeq: seq,
      blocks: blocks.length,
      fetchedAt: new Date().toISOString()
    },
    zones,
    seats
  };
}

export function nolVenueParams(venueId) {
  return Object.hasOwn(NOL_VENUE_MAP, venueId) ? NOL_VENUE_MAP[venueId] : null;
}

export function mergeNolSeatMap(base, real, mapped) {
  const positionedSeats = real.seats.filter((seat) => seat.mapPosition);
  if (positionedSeats.length === 0) return base;

  return {
    ...base,
    map: {
      ...base.map,
      title: `${mapped.label || base?.map?.title || "공연장"} 참고 좌석도`,
      description: `NOL 공연장 배치 참고 · 실제 구매 좌석은 Ticketground 판매 재고 ${base.seats.length}석에서 선택`
    },
    nolReference: {
      zones: real.zones,
      seats: positionedSeats
    },
    nolSource: real.source
  };
}

/**
 * 기존 mock 좌석맵 응답에 NOL 실데이터를 덮어씌운다.
 * 호출이 실패하면 원본(mock)을 그대로 돌려줘서 화면이 죽지 않게 한다.
 */
export async function applyNolSeatMap(base, { venueId, goodsCode, placeCode, playSeq } = {}) {
  // 외부 API 의존을 끊어야 하는 환경(테스트/오프라인)에서는 TIG_NOL_SEATMAP=0 으로 mock 을 유지한다.
  if (process.env.TIG_NOL_SEATMAP === "0") return base;
  const mapped = goodsCode && placeCode ? { goodsCode, placeCode } : nolVenueParams(venueId || base?.event?.venueId);
  if (!mapped) return base;
  try {
    const real = await fetchNolSeatMap({
      goodsCode: mapped.goodsCode,
      placeCode: mapped.placeCode,
      playSeq
    });
    return mergeNolSeatMap(base, real, mapped);
  } catch (error) {
    return {
      ...base,
      nolSource: { error: String(error?.message || error), fallback: "mock" }
    };
  }
}
