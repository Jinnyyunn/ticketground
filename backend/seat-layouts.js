function addSeat(seats, zoneId, prefix, number, x, y, section) {
  seats.push({
    zoneId,
    seatLabel: `${prefix}-${String(number).padStart(2, "0")}`,
    number,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    section
  });
}

function addGridSeats(seats, zoneId, prefix, startNumber, rows, cols, startX, startY, gapX, gapY, section) {
  let number = startNumber;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      addSeat(seats, zoneId, prefix, number, startX + col * gapX, startY + row * gapY, section);
      number += 1;
    }
  }
  return number;
}

function buildOlympicMainSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 34, 58, 4.6, 5.2, "필드 중앙 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 5, 17, 38, 4.1, 6.1, "1층 좌측 R");
  addGridSeats(seats, "zone_r", "R석", 21, 4, 5, 66, 38, 4.1, 6.1, "1층 우측 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 20, 18, 5.4, 4.1, "상단 S 관람석");
  return seats;
}

function buildArenaSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 39, 4.8, 5.5, "플로어 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 27, 58, 5.1, 4.3, "아레나 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 19, 73, 5.4, 3.8, "상단 S");
  return seats;
}

function buildTheaterSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 38, 4.8, 5.2, "오케스트라 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 25, 56, 5.5, 4.7, "메자닌 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 18, 74, 5.6, 3.9, "발코니 S");
  return seats;
}

function buildFestivalSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 36, 4.8, 5.5, "프론트 패스");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 25, 57, 5.5, 4.8, "피크닉 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 18, 75, 5.6, 3.9, "잔디 S");
  return seats;
}

export function seatLayoutForVenue(venueId) {
  if (venueId === "venue_jamsil_olympic") return buildOlympicMainSeats();
  if (venueId === "venue_bluesquare") return buildTheaterSeats();
  if (venueId === "venue_nanjipark") return buildFestivalSeats();
  return buildArenaSeats();
}
