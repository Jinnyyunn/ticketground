export type QueryParamValue = string | string[] | undefined;

export function queryParam(value: QueryParamValue) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
