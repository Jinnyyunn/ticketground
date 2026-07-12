export const workspaceKeys = [
  "overview",
  "catalog",
  "sales",
  "inventory",
  "accounts",
  "support",
  "resale",
  "admission",
  "audit",
  "acl",
] as const;

export type WorkspaceKey = (typeof workspaceKeys)[number];

export function isWorkspaceKey(value: string): value is WorkspaceKey {
  return workspaceKeys.includes(value as WorkspaceKey);
}
