const homeRoutes = Object.freeze({
  "groupbooking-dev.ticketground.co.kr": "/group-booking",
  "sellcorp-dev.ticketground.co.kr": "/seller"
});

export function publicHomeRoute(hostHeader, requestUrl) {
  if (typeof hostHeader !== "string") return null;

  let hostname;
  let url;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase();
    url = new URL(requestUrl, "http://ticketground.local");
  } catch {
    return null;
  }

  if (url.pathname !== "/") return null;
  const route = homeRoutes[hostname];
  return route ? `${route}${url.search}` : null;
}
