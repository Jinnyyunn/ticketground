export const workspaceKeys = [
  "overview",
  "catalog",
  "sales",
  "inventory",
  "accounts",
  "support",
  "finance",
  "resale",
  "admission",
  "audit",
  "acl",
  "group-booking",
  "seller-applications",
  "seller-events",
] as const;

export type WorkspaceKey = (typeof workspaceKeys)[number];

export function isWorkspaceKey(value: string): value is WorkspaceKey {
  return workspaceKeys.includes(value as WorkspaceKey);
}
