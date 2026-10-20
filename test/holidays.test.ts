import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	FIRST_HOLIDAY_YEAR,
	holidayCoverage,
	isHoliday,
	LAST_HOLIDAY_YEAR,
} from "../src/holidays.ts";

const at = (iso: string) => new Date(iso);

describe("isHoliday", () => {
	it("covers the whole New Year break and not the make-up Sunday", () => {
		assert.equal(isHoliday(at("2026-01-01T00:00:00Z")), true);
		assert.equal(isHoliday(at("2026-01-03T23:59:59Z")), true);
		assert.equal(isHoliday(at("2026-01-04T00:00:00Z")), false); // Sunday make-up workday
		assert.equal(isHoliday(at("2026-01-05T00:00:00Z")), false);
	});

	it("covers the merged 2025 National Day and Mid-Autumn break", () => {
		assert.equal(isHoliday(at("2025-10-01T00:00:00Z")), true);
		assert.equal(isHoliday(at("2025-10-08T23:59:59Z")), true);
		assert.equal(isHoliday(at("2025-10-09T00:00:00Z")), false);
	});

	it("excludes New Year's Eve 2024, which was not an official day off", () => {
		assert.equal(isHoliday(at("2024-02-09T12:00:00Z")), false); // Friday, encouraged but not official
		assert.equal(isHoliday(at("2024-02-10T00:00:00Z")), true);
		assert.equal(isHoliday(at("2024-02-17T23:59:59Z")), true);
		assert.equal(isHoliday(at("2024-02-18T00:00:00Z")), false); // Sunday make-up workday
	});

	it("covers the 2027 statutory days before the notice is out", () => {
		assert.equal(isHoliday(at("2027-01-01T02:00:00Z")), true); // New Year's Day, Friday
		assert.equal(isHoliday(at("2027-02-04T12:00:00Z")), false);
		assert.equal(isHoliday(at("2027-02-05T00:00:00Z")), true); // lunar New Year's Eve
		assert.equal(isHoliday(at("2027-02-08T23:59:59Z")), true); // 3rd day of the first month
		assert.equal(isHoliday(at("2027-02-09T00:00:00Z")), false);
		assert.equal(isHoliday(at("2027-04-05T08:00:00Z")), true); // Qingming
		assert.equal(isHoliday(at("2027-06-09T08:00:00Z")), true); // Dragon Boat
		assert.equal(isHoliday(at("2027-09-15T08:00:00Z")), true); // Mid-Autumn
		assert.equal(isHoliday(at("2027-10-01T08:00:00Z")), true); // National Day
		assert.equal(isHoliday(at("2027-10-04T08:00:00Z")), false); // not statutory
	});
});

describe("holiday coverage", () => {
	it("derives the covered years from the data", () => {
		assert.equal(FIRST_HOLIDAY_YEAR, 2024);
		assert.equal(LAST_HOLIDAY_YEAR, 2026);
	});

	it("reports announced 2024–2026, statutory 2027 and nothing outside", () => {
		assert.equal(holidayCoverage(2024), "announced");
		assert.equal(holidayCoverage(2025), "announced");
		assert.equal(holidayCoverage(2026), "announced");
		assert.equal(holidayCoverage(2027), "statutory");
		assert.equal(holidayCoverage(2023), "none");
		assert.equal(holidayCoverage(2028), "none");
	});
});
