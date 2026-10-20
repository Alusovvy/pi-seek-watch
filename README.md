# pi-seek-watch

A [pi](https://pi.dev) package that tells agents and you whether DeepSeek's API is at its **off-peak (discounted)** price right now.

- **`deepseek_pricing` tool**: model-callable and registered in every mode (interactive TUI, RPC, JSON and print), so headless sub-agents can check the price before choosing a DeepSeek model.
- **`/deepseek` command**: shows the same status in the UI.
- **Whale badge**: in the interactive TUI, a small DeepSeek whale sits in the top-right corner. It is green at off-peak price and red at peak price, and it is redrawn exactly when the tier changes.

![The badge whale in its off-peak and peak colours, each with the deepseek_pricing output for that time](https://raw.githubusercontent.com/Alusovvy/pi-seek-watch/main/assets/preview.png)

<sub>Rendered from the package's own whale and `deepseek_pricing` output, drawn in pi's dark-theme colours; not a terminal screenshot.</sub>

## Schedule

Peak (full price) is **01:00–04:00 and 06:00–10:00 UTC, Monday–Friday**. All other hours are off-peak, and so are Saturday and Sunday in full.
Source: <https://api-docs.deepseek.com/quick_start/pricing>

Chinese public holidays are off-peak in full, too, and are modelled from the official State Council holiday calendar for 2024–2026, and from the statutory days alone for 2027 until that year's calendar is announced (see [Holiday calendar](#holiday-calendar)). Outside those years the package falls back to the weekday schedule. The `note` field always says which of these applies.

## Holiday calendar

`src/holidays.ts` holds the Chinese public holidays (the State Council's annual “放假安排” days off) for **2024, 2025 and 2026**. For **2027** it holds only the statutory days for now:

| Holiday | 2024 | 2025 | 2026 | 2027 (statutory) |
|---|---|---|---|---|
| New Year's Day | Jan 1 | Jan 1 | Jan 1–3 | Jan 1 |
| Spring Festival | Feb 10–17 | Jan 28–Feb 4 | Feb 15–23 | Feb 5–8 |
| Qingming | Apr 4–6 | Apr 4–6 | Apr 4–6 | Apr 5 |
| Labor Day | May 1–5 | May 1–5 | May 1–5 | May 1–2 |
| Dragon Boat | Jun 10 | May 31–Jun 2 | Jun 19–21 | Jun 9 |
| Mid-Autumn | Sep 15–17 | *(with National Day)* | Sep 25–27 | Sep 15 |
| National Day | Oct 1–7 | Oct 1–8 | Oct 1–7 | Oct 1–3 |

The statutory days are the ones the holiday law (全国年节及纪念日放假办法, State Council Order No. 795) fixes in advance. The annual notice only adds days to them: bridge days, and a weekday off in place of a statutory day that falls on a weekend. So until the 2027 notice is out, those extra days report peak, and the `note` field says so.

Dates are inclusive and interpreted in UTC; the peak windows (01:00–10:00 UTC) map to the same calendar date in Beijing (UTC+8), so a holiday's UTC date equals its Beijing date for pricing purposes. The State Council publishes each year's arrangement in late autumn (usually November). To extend coverage, add the new year's entries to `HOLIDAYS` in `src/holidays.ts` (the covered range is derived from the data), delete that year from `STATUTORY_HOLIDAYS`, then release. Years in neither table fall back to the weekday schedule, and the `note` field reports that holidays are not modelled for that year.

Make-up workdays (调休上班日) are always Saturdays or Sundays, which are off-peak regardless of the calendar, so only the days off are listed.

## Install

```bash
pi install git:github.com/Alusovvy/pi-seek-watch
```

From npm:

```bash
pi install npm:pi-seek-watch
```

Or try it for one run without changing your settings:

```bash
pi -e git:github.com/Alusovvy/pi-seek-watch
```

Add `-l` to `pi install` to install it for the current project only (`.pi/settings.json`).

## The `deepseek_pricing` tool

The tool takes no parameters. Its prompt guidelines tell the model to call it before choosing or delegating to a DeepSeek model for cost-sensitive work.

The model sees this text:

```text
DeepSeek pricing at 2026-10-23T09:12:00.000Z: PEAK (full price).
Switches to off-peak at 2026-10-23T10:00:00.000Z (in 48 min).
Note: Chinese public holidays are off-peak all day and are modelled from the official State Council calendar.
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
  "note": "Chinese public holidays are off-peak all day and are modelled from the official State Council calendar."
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
| `note` | how Chinese public holidays are handled for that date |

`nextChangeUtc` is the next *actual* change. For example, on Friday at 10:00 UTC it is Monday 01:00 UTC, because the whole weekend is off-peak.

## The `/deepseek` command

Run `/deepseek` to get the same three lines as a notification. It is an info notification when off-peak and a warning when peak.

## The badge

The badge is drawn only in the interactive TUI (`ctx.mode === "tui"`). It is a non-capturing overlay, so it never takes focus. A single timer redraws it just after each tier change. The overlay and its timer start on `session_start`. On `session_shutdown` (quit, `/new`, `/resume`, `/fork` or reload) both are removed, so a new session never stacks a second whale.

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
PI_SEEK_WATCH_NOW=2026-02-16T08:00:00Z pi      # Spring Festival Monday: off-peak
```

On Windows `cmd`: `set PI_SEEK_WATCH_NOW=2026-10-23T02:00:00Z && pi`. Invalid dates are ignored and the real clock is used.

## Layout

```text
src/holidays.ts  Chinese public holiday calendar (State Council arrangements, statutory days for later years)
src/pricing.ts   pure schedule logic: isOffPeak(date), nextChange(date), pricingStatus(date)
src/badge.ts     TUI whale overlay
src/index.ts     extension entry: tool, command, badge
test/            node:test unit tests: schedule, holidays, and the tool, command and badge against a fake pi
assets/          gallery preview (pi.image), not shipped in the npm tarball
```

## Development

```bash
npm install   # only typebox, for the extension tests
npm test      # node --test on the .ts files (Node 22.18+ / 24 strip types natively)
```

CI (`.github/workflows/ci.yml`) runs the tests on Node 22.18 and 24 for every push to `main` and every pull request.

To release, bump `version` in `package.json`, push, then publish a GitHub release tagged with that version (`0.3.0` or `v0.3.0`). `.github/workflows/publish.yml` checks the tag against `package.json`, runs the tests and publishes to npm with provenance. It needs either an `NPM_TOKEN` repository secret (an npm automation token) or this workflow registered as a trusted publisher for the package on npmjs.com.

## License

MIT © 2026 Alusovvy
