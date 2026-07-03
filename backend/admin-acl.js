export const permissionCatalog = [
  { key: "admin.dashboard.read", label: "Dashboard", group: "운영 현황" },
  { key: "catalog.manage", label: "Catalog", group: "공연/상품" },
  { key: "accounts.manage", label: "Accounts", group: "회원/계정" },
  { key: "support.manage", label: "Support", group: "문의" },
  { key: "security.manage", label: "Security", group: "보안" },
  { key: "admission.manage", label: "Admission", group: "입장" },
  { key: "finance.read", label: "Finance", group: "정산" },
  { key: "acl.read", label: "ACL", group: "권한" }
];

const allPermissions = permissionCatalog.map((item) => item.key);

export const roleCatalog = [
  { key: "owner", name: "Owner", permissions: allPermissions },
  { key: "admin", name: "Admin", permissions: allPermissions.filter((item) => item !== "finance.read") },
  { key: "catalog", name: "Catalog", permissions: ["admin.dashboard.read", "catalog.manage"] },
  { key: "support", name: "Support", permissions: ["admin.dashboard.read", "support.manage", "accounts.manage"] },
  { key: "security", name: "Security", permissions: ["admin.dashboard.read", "security.manage", "accounts.manage", "acl.read"] },
  { key: "admission", name: "Admission", permissions: ["admin.dashboard.read", "admission.manage", "security.manage"] },
  { key: "finance", name: "Finance", permissions: ["admin.dashboard.read", "finance.read"] },
  { key: "readonly", name: "Readonly", permissions: ["admin.dashboard.read", "acl.read"] }
];

export function adminPermissionsForRoles(roleKeys) {
  return [...new Set(roleKeys.flatMap((roleKey) => roleCatalog.find((role) => role.key === roleKey)?.permissions || []))];
}

export function adminDto({ id, username, roleKeys }) {
  const roles = roleKeys.map((roleKey) => roleCatalog.find((role) => role.key === roleKey)).filter(Boolean);
  return {
    id,
    username,
    roles: roles.map(({ key, name }) => ({ key, name })),
    permissions: adminPermissionsForRoles(roleKeys)
  };
}
