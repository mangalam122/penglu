// Penglu background worker.
// A buy button can live in any frame (a payment iframe, an embedded checkout),
// but Penglu should always appear in the page's top frame. The background
// relays: the frame that saw the click -> top frame (show Penglu) -> back to
// the same frame (release or cancel).

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;

  if (msg.type === 'penglu:attempt') {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'penglu:show', label: msg.label, reason: msg.reason, sourceFrameId: sender.frameId },
      { frameId: 0 }
    );
  }

  if (msg.type === 'penglu:decision') {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'penglu:decision', decision: msg.decision },
      { frameId: msg.sourceFrameId }
    );
  }
});
