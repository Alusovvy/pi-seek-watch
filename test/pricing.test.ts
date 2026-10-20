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

describe("isOffPeak on Chinese public holidays", () => {
	it("treats weekday holidays as off-peak during peak hours", () => {
		assert.equal(isOffPeak(at("2026-02-16T02:30:00Z")), true); // Spring Festival Monday
		assert.equal(isOffPeak(at("2026-02-16T08:00:00Z")), true);
		assert.equal(isOffPeak(at("2026-10-02T08:00:00Z")), true); // National Day Friday
		assert.equal(isOffPeak(at("2026-01-01T02:00:00Z")), true); // New Year Thursday
		assert.equal(isOffPeak(at("2025-10-02T08:00:00Z")), true); // National Day Thursday
	});

	it("keeps make-up workdays off-peak because they are weekends", () => {
		assert.equal(isOffPeak(at("2026-02-14T02:00:00Z")), true); // Saturday make-up workday
		assert.equal(isOffPeak(at("2026-02-28T08:00:00Z")), true); // Saturday make-up workday
	});

	it("does not treat the eve of a holiday as off-peak when it is a workday", () => {
		assert.equal(isOffPeak(at("2024-02-09T02:00:00Z")), false); // Friday, New Year's Eve (not official)
	});
});

describe("nextChange across holidays", () => {
	it("stays off-peak through a 9-day Spring Festival and the surrounding weekend", () => {
		assert.equal(nextChange(at("2026-02-13T10:00:00Z")).toISOString(), "2026-02-24T01:00:00.000Z");
	});

	it("during a holiday reports the first weekday peak after it ends", () => {
		assert.equal(nextChange(at("2026-10-02T02:00:00Z")).toISOString(), "2026-10-08T01:00:00.000Z");
	});

	it("the evening before a holiday starts changes at the holiday's next weekday peak", () => {
		assert.equal(nextChange(at("2026-09-30T10:00:00Z")).toISOString(), "2026-10-08T01:00:00.000Z");
	});

	it("New Year's Eve 2026 skips New Year's Day 2027 and the weekend", () => {
		assert.equal(nextChange(at("2026-12-31T10:00:00Z")).toISOString(), "2027-01-04T01:00:00.000Z");
	});
});

describe("pricingStatus note", () => {
	it("says holidays are modelled within the covered years", () => {
		const s = pricingStatus(at("2026-02-16T02:00:00Z"));
		assert.equal(s.offPeak, true);
		assert.match(s.note, /modelled/);
	});

	it("says only the statutory days are modelled before the notice is out", () => {
		const s = pricingStatus(at("2027-02-05T02:00:00Z"));
		assert.equal(s.offPeak, true);
		assert.match(s.note, /statutory days only/);
	});

	it("says holidays are not modelled outside the covered years", () => {
		const s = pricingStatus(at("2030-02-14T02:00:00Z"));
		assert.match(s.note, /not modelled/);
	});
});
