# Penglu coding plan

Penglu is a penguin butler who stops impulse purchases. A Chrome extension
detects and blocks the final purchase click; a native macOS app (later) runs
the Penglu popup, the local model and the ledger.

Rule for the whole project: **code decides, the model talks.** Timers, stages
and unlock logic are plain code. A model only ever writes Penglu's lines.

## Phase 1: Extension that works on its own

Goal: clicking a final buy button on any site is held for 2 minutes by Penglu.

- [x] `extension/src/detector.js`: pure function, decides if a click is a purchase
  - text and `aria-label` / `value` matching (buy now, place order, pay ₹, checkout…)
  - checkout-like URLs raise confidence
  - excludes add to cart, wishlist, buy-again browsing links
  - unit tests with Node's built-in test runner, no dependencies
- [x] `extension/manifest.json`: Manifest V3, content script on all URLs and frames
- [x] `extension/src/content.js`: capture-phase click listener, blocks the click,
      one-time pass so the user's next click goes through
- [x] `extension/src/overlay.js`: Penglu in a Shadow DOM panel, 2-minute timer,
      questions, work-hours cost, canned lines, skip / need it buttons
- [x] `extension/test/shop.html`: fake shop with a dozen button variants
- **Demo:** load unpacked, click Place order on the test shop, Penglu appears.
- Known gap: a bare `<div>` with a click handler and no role isn't detected yet (Phase 5 teaching).

## Phase 2: Ledger in the extension (done)

- [x] Price finder that prefers the order total and ignores promos, offers and MRP
- [x] Remember the last product page per site (name, price, clean link, image)
- [x] Save each decision to `chrome.storage.local` (skipped or let through, with answers)
- [x] Toolbar popup: month total, skipped items with links, let-through list
- [x] Settings: hourly rate, price threshold, allowlist, snooze
- [x] Spotlight-style glass design for the hold and the popup, light and dark

## Phase 3: macOS app and the bridge

- [ ] SwiftUI menu-bar app (`macos/`), built in Xcode on the Mac
- [ ] Native Messaging host; extension sends `purchase_attempt`, app replies
      `release` or `cancel`; extension falls back to its overlay if the app is down
- [ ] Floating borderless `NSPanel` for Penglu, SwiftData ledger

## Phase 4: Penglu comes alive

- [ ] Apple Foundation Models with a typed `ButlerLine { line, mood }`
- [ ] Pre-generate the next line, 3-second timeout, canned fallback
- [ ] Rive animation for five moods, optional British voice

## Phase 5: Detection everywhere

- [ ] Payment gateway signals (Razorpay, PayU, Cashfree, Paytm, PhonePe, Stripe, PayPal)
- [ ] Model as judge for borderline clicks
- [ ] Teach Penglu with a right-click menu

## Phase 6: Polish

- [ ] 30-day regret checks, stats, CSV export
- [ ] Signing, notarization, DMG

## Commit style

Small commits, one idea each, imperative subject lines
("Add detector for buy-button text", not "updates").
