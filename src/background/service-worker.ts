type SaveMarkdownMessage = {
  type: "SAVE_MARKDOWN";
  payload: {
    filename: string;
    content: string;
  };
};

type SaveImageMessage = {
  type: "SAVE_IMAGES";
  payload: {
    files: Array<{
      url: string;
      filename: string;
    }>;
  };
};

type RuntimeMessage = SaveMarkdownMessage | SaveImageMessage;

async function downloadBlobText(filename: string, content: string): Promise<void> {
  const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true
  });
}

async function downloadImages(
  files: Array<{ url: string; filename: string }>
): Promise<{ failed: string[] }> {
  const failed: string[] = [];

  for (const file of files) {
    try {
      await chrome.downloads.download({
        url: file.url,
        filename: `images/${file.filename}`,
        saveAs: false
      });
    } catch (_error) {
      failed.push(file.url);
    }
  }

  return { failed };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  (async () => {
    if (message.type === "SAVE_MARKDOWN") {
      await downloadBlobText(message.payload.filename, message.payload.content);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SAVE_IMAGES") {
      const result = await downloadImages(message.payload.files);
      sendResponse({ ok: true, ...result });
      return;
    }

    sendResponse({ ok: false, error: "Unsupported message type" });
  })().catch((error: unknown) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  });

  return true;
});
