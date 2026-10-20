/**
 * Chinese public holiday calendar — the official State Council "holiday
 * arrangement" (放假安排) days off, which DeepSeek treats as off-peak in full.
 *
 * https://api-docs.deepseek.com/quick_start/pricing
 *   "Peak hours are 01:00–04:00 and 06:00–10:00 UTC, Monday through Friday,
 *    excluding Chinese public holidays. All other hours are off-peak,
 *    including weekends and Chinese public holidays in full."
 *
 * The State Council publishes each year's arrangement (including make-up
 * workdays, 调休上班日) in late autumn. The table below lists the days off as
 * announced. Make-up workdays are always Saturdays or Sundays, which are
 * off-peak regardless of the calendar, so only the days off are listed.
 *
 * Dates are inclusive and interpreted in UTC. This is exact for DeepSeek's
 * purpose: the peak windows (01:00–10:00 UTC) map to the same calendar date in
 * Beijing (UTC+8), so a holiday's UTC date equals its Beijing date there.
 *
 * Sources:
 * - 2024: 国办发明电〔2023〕7号
 *   https://www.gov.cn/zhengce/zhengceku/202310/content_6911528.htm
 * - 2025: 国办发明电〔2024〕12号
 *   https://www.gov.cn/zhengce/content/202411/content_6986382.htm
 * - 2026: 国办发明电〔2025〕7号
 *   https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
 *
 * Add each new year's entries after the State Council notice is published
 * (usually in November); the covered range is derived from the data below.
 */

export interface HolidayPeriod {
	/** Display name, e.g. "Spring Festival 2026". */
	name: string;
	/** First day off, inclusive, "YYYY-MM-DD". */
	start: string;
	/** Last day off, inclusive, "YYYY-MM-DD". */
	end: string;
}

export const HOLIDAYS: ReadonlyArray<HolidayPeriod> = [
	// 2024 — 国办发明电〔2023〕7号
	{ name: "New Year's Day 2024", start: "2024-01-01", end: "2024-01-01" },
	{ name: "Spring Festival 2024", start: "2024-02-10", end: "2024-02-17" },
	{ name: "Qingming Festival 2024", start: "2024-04-04", end: "2024-04-06" },
	{ name: "Labor Day 2024", start: "2024-05-01", end: "2024-05-05" },
	{ name: "Dragon Boat Festival 2024", start: "2024-06-10", end: "2024-06-10" },
	{ name: "Mid-Autumn Festival 2024", start: "2024-09-15", end: "2024-09-17" },
	{ name: "National Day 2024", start: "2024-10-01", end: "2024-10-07" },

	// 2025 — 国办发明电〔2024〕12号
	{ name: "New Year's Day 2025", start: "2025-01-01", end: "2025-01-01" },
	{ name: "Spring Festival 2025", start: "2025-01-28", end: "2025-02-04" },
	{ name: "Qingming Festival 2025", start: "2025-04-04", end: "2025-04-06" },
	{ name: "Labor Day 2025", start: "2025-05-01", end: "2025-05-05" },
	{ name: "Dragon Boat Festival 2025", start: "2025-05-31", end: "2025-06-02" },
	{ name: "National Day & Mid-Autumn 2025", start: "2025-10-01", end: "2025-10-08" },

	// 2026 — 国办发明电〔2025〕7号
	{ name: "New Year's Day 2026", start: "2026-01-01", end: "2026-01-03" },
	{ name: "Spring Festival 2026", start: "2026-02-15", end: "2026-02-23" },
	{ name: "Qingming Festival 2026", start: "2026-04-04", end: "2026-04-06" },
	{ name: "Labor Day 2026", start: "2026-05-01", end: "2026-05-05" },
	{ name: "Dragon Boat Festival 2026", start: "2026-06-19", end: "2026-06-21" },
	{ name: "Mid-Autumn Festival 2026", start: "2026-09-25", end: "2026-09-27" },
	{ name: "National Day 2026", start: "2026-10-01", end: "2026-10-07" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" (UTC) key for a Date. */
function utcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function buildHolidayDays(): ReadonlySet<string> {
	const days = new Set<string>();
	for (const p of HOLIDAYS) {
		const start = Date.parse(`${p.start}T00:00:00Z`);
		const end = Date.parse(`${p.end}T00:00:00Z`);
		for (let t = start; t <= end; t += DAY_MS) {
			days.add(utcDayKey(new Date(t)));
		}
	}
	return days;
}

const HOLIDAY_DAYS: ReadonlySet<string> = buildHolidayDays();

/** True when `date`'s UTC calendar day is a Chinese public holiday (day off). */
export function isHoliday(date: Date): boolean {
	return HOLIDAY_DAYS.has(utcDayKey(date));
}

/** The first year the calendar covers (derived from HOLIDAYS). */
export const FIRST_HOLIDAY_YEAR: number = Math.min(
	...HOLIDAYS.map((p) => Number(p.start.slice(0, 4))),
);

/** The last year the calendar covers (derived from HOLIDAYS). */
export const LAST_HOLIDAY_YEAR: number = Math.max(
	...HOLIDAYS.map((p) => Number(p.start.slice(0, 4))),
);

/** True when the holiday calendar has data for `year`. */
export function hasHolidayData(year: number): boolean {
	return year >= FIRST_HOLIDAY_YEAR && year <= LAST_HOLIDAY_YEAR;
}
