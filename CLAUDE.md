# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that extracts X (Twitter) post pages and exports them as Markdown files, optionally including attached images. Target URL pattern: `https://x.com/<user>/status/<tweet_id>`.

Full requirements and design are in `docs/x-article-to-markdown-extension-spec.md`.

## Build & Dev Commands

Once implemented, the expected toolchain is TypeScript + standard Chrome extension build:

```bash
npm install          # Install dependencies
npm run build        # Build extension to dist/
npm run watch        # Watch mode for development
npm run lint         # Lint TypeScript sources
```

To load the extension locally: open `chrome://extensions`, enable Developer Mode, and load the `dist/` folder as an unpacked extension.

## Planned Architecture

### Source layout (`src/`)

| Path | Role |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `src/types/index.ts` | Shared data types (`XPost`, etc.) |
| `src/content/extractor.ts` | DOM extraction — runs in page context |
| `src/core/markdown.ts` | Assembles Markdown string from `XPost` |
| `src/core/image.ts` | Image URL normalisation, filename generation |
| `src/popup/popup.ts` | Popup UI controller |
| `src/background/service-worker.ts` | Download handling, message routing |

### Data flow

1. Popup sends a message to the content script
2. `extractor.ts` walks the DOM of the active X post page and returns an `XPost` object
3. `markdown.ts` converts `XPost` → Markdown string
4. `image.ts` normalises image URLs and generates filenames
5. Popup displays a preview; user copies to clipboard, saves `.md`, or downloads images via the service worker

### Key type

```ts
type XPost = {
  id: string;
  url: string;
  authorName: string;
  authorHandle: string;
  createdAt: string;      // ISO 8601
  text: string;
  images: Array<{ url: string; alt?: string }>;
};
```

### Output format

```md
# X Post Export

- Author: Display Name (@handle)
- Date: 2026-04-10T12:34:56.000Z
- URL: https://x.com/...

## Content

(post text)

## Images

![image-01](images/<tweet_id>-01.jpg)
```

File naming: `<username>-<tweet_id>.md`, images at `images/<tweet_id>-<index>.<ext>`.

## Permissions (manifest.json)

Minimum required:
- `activeTab`, `scripting`, `downloads`
- `host_permissions`: `https://x.com/*`

Do not add permissions beyond these unless strictly necessary.

## DOM Extraction Notes

X's DOM changes frequently. Key rules:
- **Always use multiple selector candidates with fallback** — never rely on a single CSS selector
- Separate selector definitions from transformation logic (selector map in one place, processing in another) so selectors can be patched without touching logic
- Extension activates only on `x.com/*/status/*` URLs (enforced via `manifest.json` `matches`)
- Debug logging must be gated behind a dev-mode flag (e.g. `process.env.NODE_ENV === 'development'`)

## Error Messages (Japanese)

| Situation | Message |
|---|---|
| Not an X post URL | `このページはXの投稿ページではありません` |
| Extraction failed | `投稿本文を取得できませんでした。ページを再読み込みしてください` |
| Image save failed | List failed images only; continue Markdown output |

## Release Phases

- **Phase 1 (MVP)**: Single post — text + metadata + image URLs → Markdown copy/save
- **Phase 2**: Local image download + relative path embedding
- **Phase 3**: Thread stitching, template selection, retry on failure
