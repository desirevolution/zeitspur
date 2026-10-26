/** File-based native sharing. Keep navigator.share() inside the original click handler. */
export interface NativeFileShare {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}
/** Desktop sharing is intentionally disabled: desktop Web Share support is
 * inconsistent, notably in Linux browsers. Allow phones and tablets only.
 * Feature detection via canShare() is still required separately. */
export interface SharePlatformInfo {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean };
}

export function isMobileSharePlatform(
  platform: SharePlatformInfo = typeof navigator === 'undefined' ? {} : navigator,
): boolean {
  if (platform.userAgentData?.mobile === true) return true;
  if (/\b(?:Android|iPhone|iPad|iPod)\b/i.test(platform.userAgent ?? '')) return true;
  // iPadOS can present a desktop-style Safari user agent.
  return platform.platform === 'MacIntel' && (platform.maxTouchPoints ?? 0) > 1;
}

export interface ShareFormat {
  extension: string;
  mime: string;
}

export const CSV_SHARE_FORMATS: readonly ShareFormat[] = [{ extension: 'csv', mime: 'text/csv' }];
// Prefer .txt: Chromium's native share targets often reject .json files.
// This is still valid JSON, and the backup importer accepts both .txt and .json.
export const BACKUP_SHARE_FORMATS: readonly ShareFormat[] = [
  { extension: 'txt', mime: 'text/plain' },
  { extension: 'json', mime: 'application/json' },
];

/** Returns the first supported file variant; never falls back to plain share-text. */
export function chooseShareableFile(
  basename: string,
  content: string,
  formats: readonly ShareFormat[],
  api: NativeFileShare | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): File | null {
  if (!api?.canShare || !api.share || typeof File === 'undefined') return null;
  for (const format of formats) {
    const file = new File([content], `${basename}.${format.extension}`, { type: format.mime });
    try {
      if (api.canShare({ files: [file] })) return file;
    } catch { /* Unsupported MIME/extension: try the next file format. */ }
  }
  return null;
}
