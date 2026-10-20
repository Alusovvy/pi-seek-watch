/**
 * DeepSeek peak / off-peak schedule (pure, no I/O).
 *
 * Peak hours (full price) are 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday.
 * All other hours — including weekends in full — are off-peak (discounted).
 * Chinese public holidays are also off-peak in full; see ./holidays.ts.
 * https://api-docs.deepseek.com/quick_start/pricing
 */

import { hasHolidayData, isHoliday } from "./holidays.ts";

export type Tier = "off-peak" | "peak";

export const PRICING_URL = "https://api-docs.deepseek.com/quick_start/pricing";

/** Peak windows in minutes after 00:00 UTC, [start, end), Monday–Friday only. */
export const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
	[1 * 60, 4 * 60], // 01:00–04:00 UTC
	[6 * 60, 10 * 60], // 06:00–10:00 UTC
];

/** Minutes after 00:00 UTC at which the tier can change. */
const BOUNDARIES = [0, ...PEAK_WINDOWS.flat()].sort((a, b) => a - b);

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** True while DeepSeek's off-peak discount is active at `date`. */
export function isOffPeak(date: Date): boolean {
	if (isHoliday(date)) return true; // public holidays are off-peak in full
	const day = date.getUTCDay(); // 0 = Sun … 6 = Sat
	if (day === 0 || day === 6) return true; // weekends are fully off-peak
	const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
	return !PEAK_WINDOWS.some(([start, end]) => minutes >= start && minutes < end);
}

/**
 * The first instant strictly after `date` at which the tier differs from the
 * tier at `date`.
 *
 * The longest possible off-peak run is a 9-day Spring Festival wrapped by
 * weekends (Friday 10:00 UTC → the following Tuesday 01:00 UTC, ~10.6 days),
 * so scanning 32 days of boundaries always finds the next change.
 */
export function nextChange(date: Date): Date {
	const current = isOffPeak(date);
	const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	for (let d = 0; d <= 32; d++) {
		for (const minutes of BOUNDARIES) {
			const at = midnight + d * DAY + minutes * MINUTE;
			if (at > date.getTime() && isOffPeak(new Date(at)) !== current) return new Date(at);
		}
	}
	throw new Error(`no DeepSeek pricing change found after ${date.toISOString()}`);
}

export interface PricingStatus {
	offPeak: boolean;
	tier: Tier;
	/** ISO timestamp the status was computed for. */
	nowUtc: string;
	/** ISO timestamp of the next tier change. */
	nextChangeUtc: string;
	/** Whole minutes until the next tier change (rounded up). */
	nextChangeIn: number;
	nextTier: Tier;
	note: string;
}

const tierOf = (offPeak: boolean): Tier => (offPeak ? "off-peak" : "peak");

/** Caveat describing how Chinese public holidays are handled for `date`. */
export function holidayNote(date: Date): string {
	if (hasHolidayData(date.getUTCFullYear())) {
		return "Chinese public holidays are off-peak all day and are modelled from the official State Council calendar.";
	}
	return `Chinese public holidays in ${date.getUTCFullYear()} are not modelled, so on those days this may report peak.`;
}

/** Snapshot of the pricing tier at `date` and when it next changes. */
export function pricingStatus(date: Date): PricingStatus {
	const offPeak = isOffPeak(date);
	const next = nextChange(date);
	return {
		offPeak,
		tier: tierOf(offPeak),
		nowUtc: date.toISOString(),
		nextChangeUtc: next.toISOString(),
		nextChangeIn: Math.ceil((next.getTime() - date.getTime()) / MINUTE),
		nextTier: tierOf(!offPeak),
		note: holidayNote(date),
	};
}

/** "13h 5m" / "42m" */
export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Human-readable summary of a status, shared by the tool and the /deepseek command. */
export function formatStatus(s: PricingStatus): string {
	const now = s.offPeak ? "OFF-PEAK (discounted)" : "PEAK (full price)";
	const hours = s.nextChangeIn >= 60 ? ` = ${formatDuration(s.nextChangeIn)}` : "";
	return [
		`DeepSeek pricing at ${s.nowUtc}: ${now}.`,
		`Switches to ${s.nextTier} at ${s.nextChangeUtc} (in ${s.nextChangeIn} min${hours}).`,
		`Note: ${s.note}`,
	].join("\n");
}
