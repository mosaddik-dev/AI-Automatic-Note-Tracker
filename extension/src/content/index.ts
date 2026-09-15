import type { RuntimeMessage } from "../background/messages";

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "capture-screenshot-request") {
    const response: RuntimeMessage = {
      type: "capture-screenshot-response",
      tabId: message.tabId,
      pageTitle: document.title,
      pageUrl: window.location.href,
    };
    sendResponse(response);
    return true;
  }
  return false;
});
