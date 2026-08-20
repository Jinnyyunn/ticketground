import assert from "node:assert/strict";

export function publishedChartEnvelope(apiSeats, name = "브라우저 테스트 공연장") {
  return {
    ok: true,
    source: "published",
    chart: null,
    record: { id: "chart_browser_fixture", name, boundVenue: { id: "venue-browser", name: "브라우저 테스트 공연장" } },
    inventory: {
      seats: apiSeats.map((seat, index) => {
        const tier = seat.label.startsWith("VIP") ? "VIP" : seat.label.startsWith("S") ? "S" : seat.label.startsWith("A") ? "A" : "R";
        return {
          id: `layout-${index}`,
          label: seat.label,
          displayLabel: seat.displayCode ?? seat.label.match(/-(\d+)$/)?.[1] ?? seat.label,
          tier,
          price: seat.price,
          sold: !seat.available,
          x: seat.mapPosition?.x ?? 20 + (index % 20) * 32,
          y: seat.mapPosition?.y ?? 20 + Math.floor(index / 20) * 32,
          objectId: "browser-fixture-row",
          objectType: "row",
          categoryLabel: `${tier}석`,
        };
      }),
      bounds: boundsFor(apiSeats),
    },
  };
}

export async function installPublishedChartFixture(page, baseUrl, slugs) {
  const [stateResponse, catalogResponse] = await Promise.all([
    fetch(`${baseUrl}/api/state`),
    fetch(`${baseUrl}/api/catalog`),
  ]);
  assert.equal(stateResponse.status, 200);
  assert.equal(catalogResponse.status, 200);
  const state = await stateResponse.json();
  const catalog = await catalogResponse.json();
  const envelopes = new Map();
  for (const slug of slugs) {
    const eventId = catalog.data.events.find((event) => event.slug === slug)?.id;
    assert.ok(eventId, `unknown browser chart fixture slug ${slug}`);
    const unique = new Map();
    for (const ticket of state.data.tickets.filter((candidate) => candidate.eventId === eventId)) {
      const label = ticket.seatLabel ?? ticket.seatCode;
      if (!label) continue;
      const price = Number(ticket.faceValue);
      const key = `${price}\u0000${label}`;
      if (!unique.has(key)) unique.set(key, { id: ticket.id, label, price, available: ticket.status === "ON_SALE" });
    }
    assert.ok(unique.size > 0, `no browser chart fixture seats for ${slug}`);
    envelopes.set(slug, publishedChartEnvelope([...unique.values()], `${slug} 테스트 차트`));
  }
  await page.route("**/api/seat-charts/for-show/**", (route) => {
    const segments = new URL(route.request().url()).pathname.split("/");
    const slug = decodeURIComponent(segments.at(-1));
    const envelope = envelopes.get(slug);
    return envelope ? route.fulfill({ json: envelope }) : route.continue();
  });
}

function boundsFor(seats) {
  if (seats.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const points = seats.map((seat, index) => ({
    x: seat.mapPosition?.x ?? 20 + (index % 20) * 32,
    y: seat.mapPosition?.y ?? 20 + Math.floor(index / 20) * 32,
  }));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}
