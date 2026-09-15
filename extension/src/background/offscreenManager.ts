const OFFSCREEN_DOCUMENT_PATH = "src/services/transcription/offscreen.html";

export async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Capture and transcribe tab audio for note-taking.",
  });
}

export async function closeOffscreenDocumentIfIdle(hasActiveCaptures: boolean): Promise<void> {
  if (hasActiveCaptures) {
    return;
  }
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}
