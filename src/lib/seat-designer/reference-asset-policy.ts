export const REFERENCE_ASSET_MAX_BYTES = 15 * 1024 * 1024;

export function referenceAssetSizeError(size: number): string | null {
  return size > REFERENCE_ASSET_MAX_BYTES
    ? "도면 파일은 최대 15MB까지 불러올 수 있습니다."
    : null;
}
