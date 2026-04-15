import type { ExtractResult, XImage, XPost } from "../types";
import { normalizeImageUrl } from "../core/image";

const SELECTORS = {
  article: ['article[data-testid="tweet"]', "article"],
  tweetText: ['[data-testid="tweetText"]'],
  userName: ['[data-testid="User-Name"]'],
  time: ["time"],
  images: ['img[src*="pbs.twimg.com/media"]']
} as const;

const ERROR_NOT_TARGET = "このページはXの投稿ページではありません";
const ERROR_EXTRACTION_FAILED = "投稿本文を取得できませんでした。ページを再読み込みしてください";

let lastKnownUrl = location.href;
let cachedPost: XPost | null = null;

function isStatusUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^\/[^/]+\/status\/\d+/.test(parsed.pathname);
  } catch (_error) {
    return false;
  }
}

function firstElement(parent: ParentNode, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = parent.querySelector<HTMLElement>(selector);
    if (found) {
      return found;
    }
  }

  return null;
}

function collectArticles(): HTMLElement[] {
  for (const selector of SELECTORS.article) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

function hasTweetTextNode(article: HTMLElement): boolean {
  return SELECTORS.tweetText.some((selector) => article.querySelector(selector) !== null);
}

function isTargetStatusLink(href: string, tweetId: string): boolean {
  return new RegExp(`/status/${tweetId}(?:$|[/?#])`).test(href);
}

function pickMainArticle(articles: HTMLElement[], tweetId: string): HTMLElement | null {
  const matchedByStatusLink = articles.find((article) => {
    const anchors = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]');
    return Array.from(anchors).some((a) => {
      const href = a.getAttribute("href") ?? "";
      return isTargetStatusLink(href, tweetId);
    });
  });

  if (matchedByStatusLink) {
    return matchedByStatusLink;
  }

  const firstWithTweetText = articles.find((article) => hasTweetTextNode(article));
  return firstWithTweetText ?? articles[0] ?? null;
}

function extractAuthor(article: HTMLElement): { authorName: string; authorHandle: string } {
  const userNameContainer = firstElement(article, SELECTORS.userName);
  if (!userNameContainer) {
    return { authorName: "Unknown", authorHandle: "@unknown" };
  }

  const text = userNameContainer.innerText
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const handle = text.find((line) => /^@/.test(line)) ?? "@unknown";
  const name = text.find((line) => !/^@/.test(line)) ?? "Unknown";
  return { authorName: name, authorHandle: handle };
}

function headingPrefix(tagName: string): string {
  if (tagName === "H1") {
    return "#";
  }
  if (tagName === "H2") {
    return "##";
  }
  return "###";
}

function headingPrefixByLevel(level: number): string {
  if (level <= 1) {
    return "#";
  }
  if (level === 2) {
    return "##";
  }
  return "###";
}

function extractTextWithHeadingTags(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  const headings = Array.from(clone.querySelectorAll<HTMLElement>("h1, h2, h3"));

  headings.forEach((heading) => {
    const text = heading.innerText.trim();
    if (!text) {
      heading.remove();
      return;
    }
    const prefix = headingPrefix(heading.tagName);
    heading.replaceWith(document.createTextNode(`\n${prefix} ${text}\n`));
  });

  const ariaHeadings = Array.from(
    clone.querySelectorAll<HTMLElement>('[role="heading"][aria-level]')
  );
  ariaHeadings.forEach((heading) => {
    const text = heading.innerText.trim();
    if (!text) {
      heading.remove();
      return;
    }
    const level = Number.parseInt(heading.getAttribute("aria-level") ?? "3", 10);
    const prefix = headingPrefixByLevel(Number.isFinite(level) ? level : 3);
    heading.replaceWith(document.createTextNode(`\n${prefix} ${text}\n`));
  });

  return clone.innerText;
}

function cleanArticleInnerText(
  article: HTMLElement,
  author: { authorName: string; authorHandle: string }
): string {
  const rawLines = extractTextWithHeadingTags(article)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const stopMarkers = new Set([
    "記事の公開をご希望の場合",
    "プレミアムにアップグレード",
    "有料パートナーシップ",
    "関連性が高い",
    "引用を表示"
  ]);

  const lines: string[] = [];
  for (const line of rawLines) {
    if (stopMarkers.has(line)) {
      break;
    }
    if (line === author.authorName || line === author.authorHandle) {
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      lines.push(line);
      continue;
    }
    if (/^\d[\d,.]*$/.test(line)) {
      continue;
    }
    if (/^[\d,.]+万$/.test(line)) {
      continue;
    }
    if (/^(件の表示|表示)$/u.test(line)) {
      continue;
    }
    lines.push(line);
  }

  return lines.join("\n").trim();
}

function extractText(article: HTMLElement, author: { authorName: string; authorHandle: string }): string {
  const textNodes = SELECTORS.tweetText
    .flatMap((selector) => Array.from(article.querySelectorAll<HTMLElement>(selector)))
    .map((node) => extractTextWithHeadingTags(node))
    .filter((value) => value.trim().length > 0);

  const tweetText = textNodes.join("\n").trim();
  const cleanedArticleText = cleanArticleInnerText(article, author);

  // For long-form posts, tweetText can contain only teaser text.
  // Prefer the cleaned full article when it is significantly longer.
  if (cleanedArticleText.length > tweetText.length * 1.4) {
    return cleanedArticleText;
  }

  if (textNodes.length > 0) {
    return tweetText;
  }

  // Fallback for DOM variants without data-testid="tweetText":
  // pick likely body blocks only and preserve line breaks.
  const candidates = Array.from(article.querySelectorAll<HTMLElement>("div[lang], span[lang], div[dir='auto']"))
    .filter((node) => node.innerText.trim().length > 0)
    .filter((node) => !node.closest('[data-testid="User-Name"]'))
    .filter((node) => !node.closest('[role="group"]'))
    .filter((node) => !node.closest("time"))
    .map((node) => node.innerText.trim());

  const seen = new Set<string>();
  const lines = candidates
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }
      seen.add(line);
      return true;
    })
    .filter((line) => {
      if (!line) {
        return false;
      }
      if (/^@\w+$/.test(line)) {
        return false;
      }
      if (/^\d[\d,.]*$/.test(line)) {
        return false;
      }
      if (/^(引用を表示|関連性が高い|件の表示|表示)$/u.test(line)) {
        return false;
      }
      return true;
    });

  return lines.join("\n\n").trim();
}

function extractCreatedAt(article: HTMLElement): string {
  const time = firstElement(article, SELECTORS.time);
  if (time) {
    const dateTime = time.getAttribute("datetime");
    if (dateTime) {
      return new Date(dateTime).toISOString();
    }
  }
  return new Date().toISOString();
}

function extractImages(article: HTMLElement): XImage[] {
  const seen = new Set<string>();
  const images: XImage[] = [];

  for (const img of Array.from(article.querySelectorAll<HTMLImageElement>(SELECTORS.images.join(",")))) {
    const src = img.getAttribute("src");
    if (!src) {
      continue;
    }
    const url = normalizeImageUrl(src);
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    images.push({
      url,
      alt: img.getAttribute("alt") ?? undefined
    });
  }

  return images;
}

function getTweetIdFromUrl(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

function extractPost(): ExtractResult {
  if (!isStatusUrl(location.href)) {
    return { ok: false, error: ERROR_NOT_TARGET };
  }

  const tweetId = getTweetIdFromUrl(location.href);
  if (!tweetId) {
    return { ok: false, error: ERROR_EXTRACTION_FAILED };
  }

  const mainArticle = pickMainArticle(collectArticles(), tweetId);
  if (!mainArticle) {
    return { ok: false, error: ERROR_EXTRACTION_FAILED };
  }

  const author = extractAuthor(mainArticle);
  const text = extractText(mainArticle, author);
  if (!text) {
    return { ok: false, error: ERROR_EXTRACTION_FAILED };
  }

  const post: XPost = {
    id: tweetId,
    url: location.href,
    authorName: author.authorName,
    authorHandle: author.authorHandle,
    createdAt: extractCreatedAt(mainArticle),
    text,
    images: extractImages(mainArticle)
  };

  return { ok: true, post };
}

function refreshCacheIfUrlChanged(): void {
  if (lastKnownUrl !== location.href) {
    lastKnownUrl = location.href;
    cachedPost = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_POST") {
    return;
  }

  refreshCacheIfUrlChanged();

  if (!cachedPost) {
    const result = extractPost();
    if (!result.ok) {
      sendResponse(result);
      return;
    }
    cachedPost = result.post;
  }

  sendResponse({ ok: true, post: cachedPost } satisfies ExtractResult);
});
