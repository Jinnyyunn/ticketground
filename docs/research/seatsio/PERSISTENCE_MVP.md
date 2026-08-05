# Seat chart persistence + booking apply MVP

## Flow

1. Admin opens `/admin/seat-designer`, builds chart.
2. **설정** → bind show slug(s) e.g. `les-miserables`.
3. **서버 저장** → `POST /api/seat-charts` → `data/seat-charts/<id>.json`.
4. **게시** → `POST /api/seat-charts/:id/publish` sets `published: true`.
5. Booking `/booking/<slug>` → `GET /api/seat-charts/for-show/<slug>` → inventory.
6. If published chart bound to slug exists → `ChartSeatMap`; else fallback grid.

## Seat ID contract

- Designer seat `id` (or generated `__whole` / `__booth` / `__ga_N`) is the sellable id.
- Checkout query still uses `seats=` joined ids.
- Sold set is empty in MVP (no inventory hold).

## Limits

- File store only (no multi-instance DB).
- No auth on admin APIs.
- No hold/reservation lock.
- Fallback grid if nothing published.
