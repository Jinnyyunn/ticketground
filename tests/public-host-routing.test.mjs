import assert from "node:assert/strict";
import test from "node:test";
import { publicHomeRoute } from "../backend/public-host-routing.js";
import { resolveCatalogBaseUrl } from "../src/data/catalog-origin.js";

test("group-booking hostname routes its home page to the group booking form", () => {
  // Given: the dedicated group-booking hostname and a root request.
  const host = "groupbooking-dev.ticketground.co.kr";

  // When: the public home route is resolved.
  const route = publicHomeRoute(host, "/?campaign=corp");

  // Then: the group-booking path is selected and the query is preserved.
  assert.equal(route, "/group-booking?campaign=corp");
});

test("corporate seller hostname routes its home page to the seller portal", () => {
  // Given: the dedicated corporate seller hostname with an explicit port.
  const host = "sellcorp-dev.ticketground.co.kr:443";

  // When: the public home route is resolved.
  const route = publicHomeRoute(host, "/");

  // Then: the seller path is selected.
  assert.equal(route, "/seller");
});

test("dedicated hostnames leave non-root requests unchanged", () => {
  // Given: a request for a nested seller page.
  const host = "sellcorp-dev.ticketground.co.kr";

  // When: the public home route is resolved.
  const route = publicHomeRoute(host, "/seller/login");

  // Then: no redirect is requested.
  assert.equal(route, null);
});

test("server-side catalog requests prefer the configured internal origin", () => {
  // Given: a public tunnel hostname and the loopback origin of the custom server.
  const options = {
    host: "groupbooking-dev.ticketground.co.kr",
    internalBaseUrl: "http://127.0.0.1:5501/",
    proto: "https"
  };

  // When: the catalog base URL is resolved.
  const baseUrl = resolveCatalogBaseUrl(options);

  // Then: SSR uses loopback instead of recursively calling the public tunnel.
  assert.equal(baseUrl, "http://127.0.0.1:5501");
});
