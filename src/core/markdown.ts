import { toMarkdownImagePath } from "./image";
import type { GenerateOptions, XPost } from "../types";

function escapeFrontMatterValue(value: string): string {
  return value.replaceAll('"', '\\"');
}

function isLanguageLabel(line: string): boolean {
  return /^[a-z][a-z0-9#+.-]{1,19}$/i.test(line.trim());
}

function isCodeLike(line: string): boolean {
  const value = line.trim();
  if (!value) {
    return false;
  }

  return (
    /^[>#]/.test(value) ||
    /^```/.test(value) ||
    /^("{3}|'{3})/.test(value) ||
    /^\|.*\|$/.test(value) ||
    /^#!\//.test(value) ||
    /^["'][^"']+["']\s*:/.test(value) ||
    /^[\w$.[\]-]+\s*:\s*.+/.test(value) ||
    /^[)\]}],?$/.test(value) ||
    /^[-+*/%<>=!&|]+$/.test(value) ||
    /^(import|from|def|class|async|await|const|let|var|function|if|for|while|return)\b/.test(value) ||
    /^(cd|python|uv|npm|git|polymarket)\b/.test(value) ||
    /[{}()[\];=|]/.test(value)
  );
}

function isProseLike(line: string): boolean {
  const value = line.trim();
  if (!value) {
    return false;
  }
  if (isCodeLike(value)) {
    return false;
  }
  return /[.!?。]/.test(value) || /\s/.test(value);
}

function isNarrativeBoundary(line: string): boolean {
  const value = line.trim();
  if (!value || isCodeLike(value) || isLanguageLabel(value)) {
    return false;
  }

  if (/^Step\s+\d+:/i.test(value)) {
    return true;
  }

  return /^[A-Z][A-Za-z0-9'"()\- ]{8,}$/.test(value) && /[.!?:]$/.test(value);
}

function linkifyTextLine(line: string): string {
  const urlPattern = /\bhttps?:\/\/[^\s)]+/g;
  const bareDomainPattern =
    /\b((?:[a-z0-9-]+\.)+(?:com|net|org|io|app|dev|ai|co|me|jp|gg|xyz)(?:\/[^\s)]*)?)/gi;

  const withFullUrls = line.replace(urlPattern, (url) => `[${url}](${url})`);
  return withFullUrls.replace(bareDomainPattern, (candidate) => {
    // Skip if already linkified.
    if (candidate.startsWith("[") || candidate.includes("](")) {
      return candidate;
    }
    const normalized = candidate.replace(/[.,!?;:]+$/g, "");
    const trailing = candidate.slice(normalized.length);
    return `[${normalized}](https://${normalized})${trailing}`;
  });
}

function formatPostContent(text: string): string {
  const sourceLines = text.split(/\r?\n/);
  const output: string[] = [];

  for (let i = 0; i < sourceLines.length; i += 1) {
    const current = sourceLines[i]?.trimEnd() ?? "";

    if (!isLanguageLabel(current)) {
      output.push(linkifyTextLine(sourceLines[i] ?? ""));
      continue;
    }

    let cursor = i + 1;
    while (cursor < sourceLines.length && sourceLines[cursor].trim() === "") {
      cursor += 1;
    }

    if (cursor >= sourceLines.length || !isCodeLike(sourceLines[cursor])) {
      output.push(sourceLines[i] ?? "");
      continue;
    }

    const codeLines: string[] = [];
    let inQuotedBlock = false;
    let k = cursor;
    for (; k < sourceLines.length; k += 1) {
      const line = sourceLines[k] ?? "";
      const trimmed = line.trim();
      const quoteCount = (trimmed.match(/"/g) ?? []).length;

      if (isLanguageLabel(trimmed) && codeLines.length > 0) {
        break;
      }

      if (!inQuotedBlock && isNarrativeBoundary(trimmed) && codeLines.length > 0) {
        break;
      }

      const currentLooksCode = isCodeLike(trimmed);
      if (!inQuotedBlock && !currentLooksCode && trimmed !== "" && codeLines.length > 0) {
        break;
      }

      if (line.trim() === "") {
        let next = k + 1;
        while (next < sourceLines.length && sourceLines[next].trim() === "") {
          next += 1;
        }
        if (next >= sourceLines.length) {
          break;
        }
        const nextLine = sourceLines[next];
        if (isNarrativeBoundary(nextLine) || (isProseLike(nextLine) && !isCodeLike(nextLine))) {
          break;
        }
      }
      codeLines.push(line);

      if (quoteCount % 2 === 1) {
        inQuotedBlock = !inQuotedBlock;
      }
    }

    output.push(`\`\`\`${current.trim()}`);
    output.push(...codeLines);
    output.push("```");

    i = k - 1;
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildMarkdown(post: XPost, options: GenerateOptions): string {
  const lines: string[] = [];

  if (options.includeFrontMatter) {
    lines.push("---");
    lines.push(`title: "X post ${post.id}"`);
    lines.push(`author: "${escapeFrontMatterValue(post.authorName)}"`);
    lines.push(`handle: "${escapeFrontMatterValue(post.authorHandle)}"`);
    lines.push(`date: "${escapeFrontMatterValue(post.createdAt)}"`);
    lines.push(`url: "${escapeFrontMatterValue(post.url)}"`);
    lines.push("---");
    lines.push("");
  }

  lines.push("# X Post Export");
  lines.push("");
  lines.push(`- Author: ${post.authorName} (${post.authorHandle})`);
  lines.push(`- Date: ${post.createdAt}`);
  lines.push(`- URL: ${post.url}`);
  lines.push("");
  lines.push("## Content");
  lines.push("");
  lines.push(post.text ? formatPostContent(post.text) : "（本文を取得できませんでした）");
  lines.push("");
  lines.push("## Images");
  lines.push("");

  if (post.images.length === 0) {
    lines.push("（画像なし）");
  } else {
    post.images.forEach((image, index) => {
      const path = options.saveImagesLocally
        ? toMarkdownImagePath(post.id, index, image.url)
        : image.url;
      lines.push(`![image-${String(index + 1).padStart(2, "0")}](${path})`);
    });
  }

  return `${lines.join("\n")}\n`;
}

export function buildMarkdownFileName(post: XPost): string {
  const handle = post.authorHandle.replace(/^@/, "");
  const safeHandle = handle.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = post.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeHandle}-${safeId}.md`;
}
