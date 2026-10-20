import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	FIRST_HOLIDAY_YEAR,
	hasHolidayData,
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
});

describe("holiday coverage", () => {
	it("derives the covered years from the data", () => {
		assert.equal(FIRST_HOLIDAY_YEAR, 2024);
		assert.equal(LAST_HOLIDAY_YEAR, 2026);
	});

	it("reports coverage for 2024–2026 and not outside", () => {
		assert.equal(hasHolidayData(2024), true);
		assert.equal(hasHolidayData(2025), true);
		assert.equal(hasHolidayData(2026), true);
		assert.equal(hasHolidayData(2023), false);
		assert.equal(hasHolidayData(2027), false);
	});
});
