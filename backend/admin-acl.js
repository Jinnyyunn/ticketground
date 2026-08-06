export const permissionCatalog = [
  { key: "admin.dashboard.read", label: "운영 현황 조회", group: "운영 현황" },
  { key: "catalog.manage", label: "공연/상품 관리", group: "공연/상품" },
  { key: "accounts.manage", label: "회원 계정 관리", group: "회원/계정" },
  { key: "support.manage", label: "고객 문의 관리", group: "문의" },
  { key: "groupBooking.manage", label: "단체/기관 예매 관리", group: "단체/기관" },
  { key: "security.manage", label: "보안 감사 관리", group: "보안" },
  { key: "admission.manage", label: "입장 관리", group: "입장" },
  { key: "finance.read", label: "정산 조회", group: "정산" },
  { key: "sellerApplications.manage", label: "기업 판매자 신청 관리", group: "기업/판매자" },
  { key: "acl.read", label: "ACL", group: "권한" },
  { key: "acl.manage", label: "ACL 관리", group: "권한" }
];

const allPermissions = permissionCatalog.map((item) => item.key);

export const roleCatalog = [
  { key: "owner", name: "소유자", permissions: allPermissions },
  { key: "admin", name: "운영 관리자", permissions: allPermissions.filter((item) => item !== "finance.read") },
  { key: "catalog", name: "공연 관리자", permissions: ["admin.dashboard.read", "catalog.manage"] },
  { key: "support", name: "고객 지원", permissions: ["admin.dashboard.read", "support.manage", "accounts.manage"] },
  { key: "groupBooking", name: "단체/기관 예매 담당", permissions: ["admin.dashboard.read", "groupBooking.manage"] },
  { key: "security", name: "보안 감사", permissions: ["admin.dashboard.read", "security.manage", "accounts.manage", "acl.read"] },
  { key: "admission", name: "입장 관리자", permissions: ["admin.dashboard.read", "admission.manage", "security.manage"] },
  { key: "finance", name: "정산 조회", permissions: ["admin.dashboard.read", "finance.read"] },
  { key: "sellerApplications", name: "기업 판매자 신청 담당", permissions: ["admin.dashboard.read", "sellerApplications.manage"] },
  { key: "readonly", name: "조회 전용", permissions: ["admin.dashboard.read", "acl.read"] }
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

function normalizeIp(ip) {
  const value = String(ip || "").trim();
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

function ipv4ToInteger(ip) {
  const octets = normalizeIp(ip).split(".");
  if (octets.length !== 4) return null;
  const values = octets.map((octet) => Number(octet));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return values.reduce((result, value) => ((result << 8) | value) >>> 0, 0);
}

export function normalizeAdminIpAllowlist(value) {
  const values = Array.isArray(value) ? value : [];
  const entries = [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
  for (const entry of entries) {
    const parts = entry.split("/");
    const [ip, prefix] = parts;
    const parsed = ipv4ToInteger(ip);
    if (parts.length > 2 || parsed === null || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > 32))) {
      throw new Error("IP ACL은 IPv4 주소 또는 CIDR 형식으로 입력해주세요.");
    }
  }
  return entries;
}

export function isAdminIpAllowed(ip, allowlist) {
  const rules = normalizeAdminIpAllowlist(allowlist);
  if (!rules.length) return true;
  const address = ipv4ToInteger(ip);
  if (address === null) return false;
  return rules.some((rule) => {
    const [ruleIp, prefixValue] = rule.split("/");
    const ruleAddress = ipv4ToInteger(ruleIp);
    const prefix = prefixValue === undefined ? 32 : Number(prefixValue);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (address & mask) === (ruleAddress & mask);
  });
}
