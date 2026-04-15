const IMAGE_HOST_PATTERN = /pbs\.twimg\.com/i;

export function detectImageExtension(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const format = url.searchParams.get("format");
    if (format && /^[a-z0-9]+$/i.test(format)) {
      return format.toLowerCase();
    }
  } catch (_error) {
    // Ignore parse error and fallback below.
  }

  const matched = rawUrl.match(/\.([a-zA-Z0-9]{3,4})(?:$|\?)/);
  if (matched?.[1]) {
    return matched[1].toLowerCase();
  }

  return "jpg";
}

export function normalizeImageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (!IMAGE_HOST_PATTERN.test(url.hostname)) {
      return rawUrl;
    }

    const name = url.searchParams.get("name");
    if (!name) {
      url.searchParams.set("name", "orig");
    }

    return url.toString();
  } catch (_error) {
    return rawUrl;
  }
}

export function buildImageFileName(tweetId: string, index: number, sourceUrl: string): string {
  const padded = String(index + 1).padStart(2, "0");
  const ext = detectImageExtension(sourceUrl);
  return `${tweetId}-${padded}.${ext}`;
}

export function toMarkdownImagePath(tweetId: string, index: number, sourceUrl: string): string {
  return `images/${buildImageFileName(tweetId, index, sourceUrl)}`;
}
