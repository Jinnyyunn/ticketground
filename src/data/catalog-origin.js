/**
 * @param {{ readonly host: string; readonly internalBaseUrl?: string; readonly proto: string }} options
 */
export function resolveCatalogBaseUrl({ host, internalBaseUrl, proto }) {
  const configured = internalBaseUrl?.trim().replace(/\/+$/, "");
  return configured || `${proto}://${host}`;
}
