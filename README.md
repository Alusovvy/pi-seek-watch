# pi-seek-watch

A [pi](https://pi.dev) package that tells agents and you whether DeepSeek's API is at its **off-peak (discounted)** price right now.

- **`deepseek_pricing` tool**: model-callable and registered in every mode (interactive TUI, RPC, JSON and print), so headless sub-agents can check the price before choosing a DeepSeek model.
- **`/deepseek` command**: shows the same status in the UI.
- **Whale badge**: in the interactive TUI, a small DeepSeek whale sits in the top-right corner. It is green at off-peak price and red at peak price, and it is redrawn exactly when the tier changes.

## Schedule

Peak (full price) is **01:00–04:00 and 06:00–10:00 UTC, Monday–Friday**. All other hours are off-peak, and so are Saturday and Sunday in full.
Source: <https://api-docs.deepseek.com/quick_start/pricing>

> **Holiday caveat:** DeepSeek also treats Chinese public holidays as off-peak all day. This package has no holiday calendar, so on those days it may report peak while DeepSeek actually charges off-peak.

## Install

```bash
pi install git:github.com/Alusovvy/pi-seek-watch
```

Or try it for one run without changing your settings:

```bash
pi -e git:github.com/Alusovvy/pi-seek-watch
```

Add `-l` to `pi install` to install it for the current project only (`.pi/settings.json`). The package is not published to npm.

## The `deepseek_pricing` tool

The tool takes no parameters. Its prompt guidelines tell the model to call it before choosing or delegating to a DeepSeek model for cost-sensitive work.

The model sees this text:

```text
DeepSeek pricing at 2026-10-23T09:12:00.000Z: PEAK (full price).
Switches to off-peak at 2026-10-23T10:00:00.000Z (in 48 min).
Note: Chinese public holidays are off-peak all day but are not modelled, so on those days this may report peak.
```

The same data is returned as `details`. It is also returned as `structuredContent`, which matches the tool's `outputSchema`, so programmatic callers such as codemode scripts get it as an object:

```json
{
  "offPeak": false,
  "tier": "peak",
  "nowUtc": "2026-10-23T09:12:00.000Z",
  "nextChangeUtc": "2026-10-23T10:00:00.000Z",
  "nextChangeIn": 48,
  "nextTier": "off-peak",
  "note": "Chinese public holidays are off-peak all day but are not modelled, so on those days this may report peak."
}
```

| Field | Meaning |
|---|---|
| `offPeak` | `true` while the discount applies |
| `tier` | `"off-peak"` or `"peak"` |
| `nowUtc` | the instant the status was computed for (ISO, UTC) |
| `nextChangeUtc` | when the tier next changes (ISO, UTC) |
| `nextChangeIn` | minutes until then, rounded up |
| `nextTier` | the tier after that change |
| `note` | the holiday caveat |

`nextChangeUtc` is the next *actual* change. For example, on Friday at 10:00 UTC it is Monday 01:00 UTC, because the whole weekend is off-peak.

## The `/deepseek` command

Run `/deepseek` to get the same three lines as a notification. It is an info notification when off-peak and a warning when peak.

## The badge

The badge is drawn only in the interactive TUI (`ctx.mode === "tui"`). It is a non-capturing overlay, so it never takes focus. A single timer redraws it just after each tier change. The timer starts on `session_start` and is cleared on `session_shutdown`.

```text
  .-""-.
 / o  o \
  `-..-'
```

## Testing override

Set `PI_SEEK_WATCH_NOW` to an ISO date to make the tool, the command and the badge use that instant instead of the clock:

```bash
PI_SEEK_WATCH_NOW=2026-10-24T08:00:00Z pi      # a Saturday: off-peak
PI_SEEK_WATCH_NOW=2026-10-23T02:00:00Z pi      # a Friday, 02:00 UTC: peak
```

On Windows `cmd`: `set PI_SEEK_WATCH_NOW=2026-10-23T02:00:00Z && pi`. Invalid dates are ignored and the real clock is used.

## Layout

```text
src/pricing.ts   pure schedule logic: isOffPeak(date), nextChange(date), pricingStatus(date)
src/badge.ts     TUI whale overlay
src/index.ts     extension entry: tool, command, badge
test/            node:test unit tests for src/pricing.ts
```

## Development

```bash
npm test   # node --test on the .ts files (Node 22.18+ / 24 strip types natively)
```

## License

MIT © 2026 Alusovvy
