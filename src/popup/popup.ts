import { buildImageFileName } from "../core/image";
import { buildMarkdown, buildMarkdownFileName } from "../core/markdown";
import type { ExtractResult, GenerateOptions, XPost } from "../types";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const errorEl = document.querySelector<HTMLParagraphElement>("#error");
const previewEl = document.querySelector<HTMLTextAreaElement>("#preview");

const includeThreadCheckbox = document.querySelector<HTMLInputElement>("#include-thread");
const saveImagesCheckbox = document.querySelector<HTMLInputElement>("#save-images");
const frontMatterCheckbox = document.querySelector<HTMLInputElement>("#front-matter");

const generateBtn = document.querySelector<HTMLButtonElement>("#generate-btn");
const copyBtn = document.querySelector<HTMLButtonElement>("#copy-btn");
const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");

let latestPost: XPost | null = null;
let latestMarkdown = "";

const ERROR_NOT_TARGET = "このページはXの投稿ページではありません";

function setError(message: string): void {
  if (errorEl) {
    errorEl.textContent = message;
  }
}

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function updateActionButtons(enabled: boolean): void {
  if (copyBtn) {
    copyBtn.disabled = !enabled;
  }
  if (saveBtn) {
    saveBtn.disabled = !enabled;
  }
}

async function queryActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) {
    throw new Error(ERROR_NOT_TARGET);
  }
  return tab;
}

function readOptions(): GenerateOptions {
  return {
    includeThread: includeThreadCheckbox?.checked ?? false,
    saveImagesLocally: saveImagesCheckbox?.checked ?? false,
    includeFrontMatter: frontMatterCheckbox?.checked ?? false
  };
}

async function extractFromPage(): Promise<ExtractResult> {
  const tab = await queryActiveTab();
  const response = await chrome.tabs.sendMessage(tab.id as number, {
    type: "EXTRACT_POST"
  });
  return response as ExtractResult;
}

async function generateMarkdown(): Promise<void> {
  setError("");
  setStatus("抽出中...");
  updateActionButtons(false);

  try {
    const result = await extractFromPage();
    if (!result.ok) {
      throw new Error(result.error);
    }

    latestPost = result.post;
    latestMarkdown = buildMarkdown(result.post, readOptions());

    if (previewEl) {
      previewEl.value = latestMarkdown;
    }

    updateActionButtons(true);
    setStatus("対象ページ");
  } catch (error: unknown) {
    latestPost = null;
    latestMarkdown = "";
    if (previewEl) {
      previewEl.value = "";
    }
    setStatus("対象外ページ");
    setError(error instanceof Error ? error.message : ERROR_NOT_TARGET);
  }
}

async function copyMarkdown(): Promise<void> {
  if (!latestMarkdown) {
    return;
  }
  await navigator.clipboard.writeText(latestMarkdown);
  setStatus("クリップボードへコピーしました");
}

async function saveMarkdown(): Promise<void> {
  if (!latestPost || !latestMarkdown) {
    return;
  }

  const fileName = buildMarkdownFileName(latestPost);
  const saveResponse = await chrome.runtime.sendMessage({
    type: "SAVE_MARKDOWN",
    payload: {
      filename: fileName,
      content: latestMarkdown
    }
  });

  if (!saveResponse?.ok) {
    throw new Error(saveResponse?.error ?? "Markdown保存に失敗しました");
  }

  if (readOptions().saveImagesLocally && latestPost.images.length > 0) {
    const imageResponse = await chrome.runtime.sendMessage({
      type: "SAVE_IMAGES",
      payload: {
        files: latestPost.images.map((image, index) => ({
          url: image.url,
          filename: buildImageFileName(latestPost!.id, index, image.url)
        }))
      }
    });

    if (!imageResponse?.ok) {
      throw new Error(imageResponse?.error ?? "画像保存に失敗しました");
    }

    if (Array.isArray(imageResponse.failed) && imageResponse.failed.length > 0) {
      setError(`一部の画像保存に失敗しました: ${imageResponse.failed.join(", ")}`);
    } else {
      setError("");
    }
  }

  setStatus("保存が完了しました");
}

function bootstrap(): void {
  generateBtn?.addEventListener("click", () => {
    generateMarkdown().catch((error: unknown) => {
      setError(error instanceof Error ? error.message : "処理に失敗しました");
    });
  });

  copyBtn?.addEventListener("click", () => {
    copyMarkdown().catch((error: unknown) => {
      setError(error instanceof Error ? error.message : "コピーに失敗しました");
    });
  });

  saveBtn?.addEventListener("click", () => {
    saveMarkdown().catch((error: unknown) => {
      setError(error instanceof Error ? error.message : "保存に失敗しました");
    });
  });

  generateMarkdown().catch((_error) => {
    // Auto check at startup; interactive action will show detailed errors.
  });
}

bootstrap();
