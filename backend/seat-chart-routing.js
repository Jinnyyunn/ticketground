const seatChartRoutePattern = /^\/api\/seat-charts(?:\/|$)/;
const publishedSeatChartPatterns = [
  /^\/api\/seat-charts\/for-show\/[^/]+$/,
  /^\/api\/seat-charts\/assets\/asset_[a-z0-9]+$/,
  /^\/api\/seat-charts\/chart_[a-z0-9]+\/versions\/rev_[a-z0-9]+$/,
  /^\/api\/venues\/[^/]+\/seat-chart$/,
  /^\/api\/performances\/[^/]+\/seat-map$/,
];

export function isSeatChartRoute(pathname) {
  return seatChartRoutePattern.test(pathname);
}

export function isPublishedSeatChartRead(method, pathname) {
  return method === "GET" && publishedSeatChartPatterns.some((pattern) => pattern.test(pathname));
}
