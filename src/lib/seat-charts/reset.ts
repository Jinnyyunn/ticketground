import { createHash } from "node:crypto";
import { cp, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export class SeatChartArchiveVerificationError extends Error {
  constructor() {
    super("SEAT_CHART_ARCHIVE_VERIFICATION_FAILED");
    this.name = "SeatChartArchiveVerificationError";
  }
}

async function fileManifest(rootDir: string): Promise<Map<string, string>> {
  const manifest = new Map<string, string>();
  async function visit(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(rootDir, absolutePath);
        const digest = createHash("sha256").update(await readFile(absolutePath)).digest("hex");
        manifest.set(relativePath, digest);
      }
    }
  }
  await visit(rootDir);
  return manifest;
}

function manifestsMatch(first: Map<string, string>, second: Map<string, string>): boolean {
  if (first.size !== second.size) return false;
  return [...first].every(([name, digest]) => second.get(name) === digest);
}

async function syncTree(rootDir: string): Promise<void> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const targetPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await syncTree(targetPath);
    } else if (entry.isFile()) {
      const handle = await open(targetPath, "r");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
  }
  const directory = await open(rootDir, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function archiveAndResetLegacyCharts(input: {
  readonly legacyDir: string;
  readonly archiveRoot: string;
  readonly now: Date;
}): Promise<{ readonly archivePath: string; readonly archivedCount: number }> {
  const legacyDir = path.resolve(input.legacyDir);
  const archiveRoot = path.resolve(input.archiveRoot);
  if (archiveRoot === legacyDir || archiveRoot.startsWith(`${legacyDir}${path.sep}`)) {
    throw new TypeError("archiveRoot must be outside legacyDir");
  }
  await stat(legacyDir);
  await mkdir(archiveRoot, { recursive: true });
  const stamp = input.now.toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(archiveRoot, `seat-charts-${stamp}`);
  await cp(legacyDir, archivePath, { recursive: true, errorOnExist: true, force: false });
  const [sourceManifest, archiveManifest] = await Promise.all([
    fileManifest(legacyDir),
    fileManifest(archivePath),
  ]);
  if (!manifestsMatch(sourceManifest, archiveManifest)) {
    throw new SeatChartArchiveVerificationError();
  }
  await syncTree(archivePath);

  const quarantinePath = `${legacyDir}.reset-${stamp}`;
  await rename(legacyDir, quarantinePath);
  try {
    await mkdir(legacyDir);
    await writeFile(path.join(legacyDir, ".gitkeep"), "", "utf8");
  } catch (error) {
    await rename(quarantinePath, legacyDir);
    throw error;
  }
  await rm(quarantinePath, { recursive: true });
  return {
    archivePath,
    archivedCount: [...sourceManifest.keys()].filter((name) => name.endsWith(".json")).length,
  };
}
