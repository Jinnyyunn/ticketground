import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type SeatChartServiceScope = "seat-chart:read" | "seat-chart:write";

export type ServiceCredentialRecord = {
  readonly id: string;
  readonly label: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly salt: string;
  readonly digest: string;
  readonly scopes: readonly SeatChartServiceScope[];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt?: string;
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function consumeServiceCredentialRateLimit(id: string, now = new Date(), limit = 120): boolean {
  const timestamp = now.getTime();
  const bucket = rateLimitBuckets.get(id);
  if (!bucket || bucket.resetAt <= timestamp) {
    rateLimitBuckets.set(id, { count: 1, resetAt: timestamp + 60_000 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export const seatChartServiceCredentialRoot = process.env.TIG_SEAT_CHART_CREDENTIAL_DIR
  ? path.resolve(process.env.TIG_SEAT_CHART_CREDENTIAL_DIR)
  : path.join(process.cwd(), "data", "seat-chart-service-credentials");

function credentialPath(rootDir: string, id: string): string {
  if (!/^sck_[a-z0-9]+$/.test(id)) throw new TypeError("INVALID_SERVICE_CREDENTIAL_ID");
  return path.join(rootDir, `${id}.json`);
}

async function writeRecord(rootDir: string, record: ServiceCredentialRecord): Promise<void> {
  await mkdir(rootDir, { recursive: true });
  const target = credentialPath(rootDir, record.id);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

function digestCredential(credential: string, salt: string): Buffer {
  return scryptSync(credential, salt, 32, { N: 16_384, r: 8, p: 1 });
}

export async function issueServiceCredential(input: {
  readonly rootDir: string;
  readonly label: string;
  readonly scopes: readonly SeatChartServiceScope[];
  readonly expiresAt: string;
  readonly now?: Date;
}): Promise<{ readonly credential: string; readonly record: ServiceCredentialRecord }> {
  if (!input.label.trim() || input.scopes.length === 0) throw new TypeError("INVALID_SERVICE_CREDENTIAL");
  const now = input.now ?? new Date();
  if (new Date(input.expiresAt).getTime() <= now.getTime()) throw new TypeError("INVALID_SERVICE_CREDENTIAL_EXPIRY");
  const secret = randomBytes(32).toString("base64url");
  const credential = `tig_sc_${secret}`;
  const salt = randomBytes(16).toString("base64url");
  const record: ServiceCredentialRecord = {
    id: `sck_${randomBytes(12).toString("hex")}`,
    label: input.label.trim(),
    prefix: credential.slice(0, 12),
    suffix: credential.slice(-6),
    salt,
    digest: digestCredential(credential, salt).toString("base64url"),
    scopes: [...new Set(input.scopes)],
    createdAt: now.toISOString(),
    expiresAt: new Date(input.expiresAt).toISOString(),
  };
  await writeRecord(input.rootDir, record);
  return { credential, record };
}

export async function listServiceCredentials(rootDir: string): Promise<readonly ServiceCredentialRecord[]> {
  let files: string[];
  try {
    files = await readdir(rootDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(files.filter((file) => /^sck_[a-z0-9]+\.json$/.test(file)).map(async (file) => JSON.parse(await readFile(path.join(rootDir, file), "utf8")) as ServiceCredentialRecord));
}

export async function verifyServiceCredential(input: {
  readonly rootDir: string;
  readonly authorization: string | null;
  readonly queryCredential?: string | null;
  readonly scope: SeatChartServiceScope;
  readonly now?: Date;
}): Promise<ServiceCredentialRecord | null> {
  if (input.queryCredential || !input.authorization?.startsWith("Bearer ")) return null;
  const credential = input.authorization.slice(7);
  if (!credential.startsWith("tig_sc_")) return null;
  const now = input.now ?? new Date();
  const records = await listServiceCredentials(input.rootDir);
  for (const record of records) {
    if (record.revokedAt || new Date(record.expiresAt).getTime() <= now.getTime() || !record.scopes.includes(input.scope)) continue;
    const actual = digestCredential(credential, record.salt);
    const expected = Buffer.from(record.digest, "base64url");
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return record;
  }
  return null;
}

export async function revokeServiceCredential(rootDir: string, id: string, now = new Date()): Promise<ServiceCredentialRecord | null> {
  try {
    const record = JSON.parse(await readFile(credentialPath(rootDir, id), "utf8")) as ServiceCredentialRecord;
    const revoked = { ...record, revokedAt: now.toISOString() };
    await writeRecord(rootDir, revoked);
    return revoked;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
