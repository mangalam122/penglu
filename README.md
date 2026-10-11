# Penglu

Penglu is a small penguin butler who stops impulse purchases. When you click
the final "Buy" or "Place order" button on any website, Penglu holds the order
for 2 minutes, asks why you need it, shows what it costs in hours of your work,
and politely begs you to reconsider. Everything you skip is kept in a ledger,
with its link, so you can see how much you saved each month.

> "I beg your pardon, sir, but I must intervene. Do sit down."

## How it's built

| Part | What it does | Status |
|---|---|---|
| `extension/` | Chrome extension: detects purchase clicks, blocks them, runs the hold | Phase 1 done |
| `macos/` | Native menu-bar app: floating Penglu popup, local model, ledger | Phase 2+ |

The extension works on its own. Once the Mac app exists, the extension hands
the purchase to it over Native Messaging and only falls back to its own
in-page overlay when the app isn't running.

## Try the extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension/` folder.
3. On the Penglu card, click **Details** and turn on **Allow access to file URLs**
   (only needed for the local test shop).
4. Open `extension/test/shop.html` and click **Place order**.

The first time, Penglu asks what you earn in an hour so he can turn prices
into hours of work. He remembers it after that.

## Run the tests

```bash
npm test
```

See [docs/PLAN.md](docs/PLAN.md) for the coding plan.
