const seatChartRoutePattern = /^\/api\/seat-charts(?:\/|$)/;
const publishedSeatChartPattern = /^\/api\/seat-charts\/for-show\/[^/]+$/;

export function isSeatChartRoute(pathname) {
  return seatChartRoutePattern.test(pathname);
}

export function isPublishedSeatChartRead(method, pathname) {
  return method === "GET" && publishedSeatChartPattern.test(pathname);
}
