import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOffPeak, nextChange, pricingStatus } from "../src/pricing.ts";

// 2026-10-19 is a Monday; 2026-10-23 a Friday; 2026-10-24/25 the weekend.
const at = (iso: string) => new Date(iso);

describe("isOffPeak on weekdays", () => {
	it("is peak inside both windows", () => {
		assert.equal(isOffPeak(at("2026-10-20T02:30:00Z")), false);
		assert.equal(isOffPeak(at("2026-10-20T08:00:00Z")), false);
	});

	it("is off-peak outside the windows", () => {
		assert.equal(isOffPeak(at("2026-10-20T00:30:00Z")), true);
		assert.equal(isOffPeak(at("2026-10-20T05:00:00Z")), true);
		assert.equal(isOffPeak(at("2026-10-20T12:00:00Z")), true);
		assert.equal(isOffPeak(at("2026-10-20T23:59:00Z")), true);
	});

	const boundaries: Array<[string, boolean]> = [
		["00:59", true],
		["01:00", false],
		["03:59", false],
		["04:00", true],
		["05:59", true],
		["06:00", false],
		["09:59", false],
		["10:00", true],
	];
	for (const [hhmm, offPeak] of boundaries) {
		it(`${hhmm} UTC is ${offPeak ? "off-peak" : "peak"}`, () => {
			assert.equal(isOffPeak(at(`2026-10-21T${hhmm}:00Z`)), offPeak);
			// last second of the minute too
			assert.equal(isOffPeak(at(`2026-10-21T${hhmm}:59.999Z`)), offPeak);
		});
	}

	it("uses UTC, not the local offset of the input", () => {
		// 02:00 UTC expressed in UTC+8
		assert.equal(isOffPeak(at("2026-10-20T10:00:00+08:00")), false);
	});
});

describe("isOffPeak on weekends", () => {
	for (const day of ["2026-10-24", "2026-10-25"]) {
		it(`${day} is off-peak during weekday peak hours`, () => {
			for (const hhmm of ["01:00", "02:30", "03:59", "06:00", "08:00", "09:59"]) {
				assert.equal(isOffPeak(at(`${day}T${hhmm}:00Z`)), true, hhmm);
			}
		});
	}
});

describe("nextChange", () => {
	it("crosses midnight from a weekday evening to 01:00 next day", () => {
		assert.equal(nextChange(at("2026-10-20T22:00:00Z")).toISOString(), "2026-10-21T01:00:00.000Z");
	});

	it("crosses midnight from Sunday evening to Monday 01:00", () => {
		assert.equal(nextChange(at("2026-10-25T23:30:00Z")).toISOString(), "2026-10-26T01:00:00.000Z");
	});

	it("walks through the weekday windows", () => {
		assert.equal(nextChange(at("2026-10-21T01:00:00Z")).toISOString(), "2026-10-21T04:00:00.000Z");
		assert.equal(nextChange(at("2026-10-21T04:00:00Z")).toISOString(), "2026-10-21T06:00:00.000Z");
		assert.equal(nextChange(at("2026-10-21T06:00:00Z")).toISOString(), "2026-10-21T10:00:00.000Z");
		assert.equal(nextChange(at("2026-10-21T10:00:00Z")).toISOString(), "2026-10-22T01:00:00.000Z");
	});

	it("is strictly after the input at a boundary", () => {
		assert.equal(nextChange(at("2026-10-21T00:59:59.999Z")).toISOString(), "2026-10-21T01:00:00.000Z");
	});

	it("Friday 09:00 (peak) changes to off-peak at Friday 10:00", () => {
		assert.equal(nextChange(at("2026-10-23T09:00:00Z")).toISOString(), "2026-10-23T10:00:00.000Z");
	});

	it("Friday 10:00 stays off-peak through Saturday and Sunday until Monday 01:00", () => {
		assert.equal(nextChange(at("2026-10-23T10:00:00Z")).toISOString(), "2026-10-26T01:00:00.000Z");
		assert.equal(nextChange(at("2026-10-24T03:00:00Z")).toISOString(), "2026-10-26T01:00:00.000Z");
	});
});

describe("pricingStatus", () => {
	it("reports peak with minutes until the change", () => {
		const s = pricingStatus(at("2026-10-23T09:00:30Z"));
		assert.equal(s.offPeak, false);
		assert.equal(s.tier, "peak");
		assert.equal(s.nextTier, "off-peak");
		assert.equal(s.nowUtc, "2026-10-23T09:00:30.000Z");
		assert.equal(s.nextChangeUtc, "2026-10-23T10:00:00.000Z");
		assert.equal(s.nextChangeIn, 60); // 59.5 min, rounded up
		assert.match(s.note, /holiday/i);
	});

	it("reports off-peak", () => {
		const s = pricingStatus(at("2026-10-24T12:00:00Z"));
		assert.equal(s.offPeak, true);
		assert.equal(s.tier, "off-peak");
		assert.equal(s.nextTier, "peak");
		assert.equal(s.nextChangeIn, (13 + 24) * 60);
	});
});
