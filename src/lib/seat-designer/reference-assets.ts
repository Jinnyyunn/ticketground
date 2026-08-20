import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  prepareReferenceAsset,
  type StoredReferenceAsset,
} from "./reference-asset-sanitize.ts";

export { ReferenceAssetValidationError, type StoredReferenceAsset } from "./reference-asset-sanitize.ts";

async function writeExclusive(targetPath: string, bytes: Buffer): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const handle = await open(targetPath, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function sanitizeReferenceAsset(input: {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly declaredMediaType: string;
  readonly purpose: StoredReferenceAsset["kind"];
  readonly page?: number;
  readonly storageDir: string;
}): Promise<StoredReferenceAsset> {
  const prepared = await prepareReferenceAsset(input);
  await writeExclusive(path.join(input.storageDir, `${prepared.asset.id}.${prepared.extension}`), prepared.storedBytes);
  return prepared.asset;
}

export async function readStoredReferenceAsset(input: {
  readonly assetId: string;
  readonly storageDir: string;
}): Promise<{ readonly bytes: Buffer; readonly mediaType: StoredReferenceAsset["mediaType"] } | null> {
  if (!/^asset_[a-z0-9]{20,}$/.test(input.assetId)) return null;
  for (const [extension, mediaType] of [["png", "image/png"], ["pdf", "application/pdf"]] as const) {
    try {
      return { bytes: await readFile(path.join(input.storageDir, `${input.assetId}.${extension}`)), mediaType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}
