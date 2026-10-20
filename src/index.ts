/**
 * pi-seek-watch: is DeepSeek at its off-peak (discounted) price right now?
 *
 * - `deepseek_pricing` tool, registered in every mode (TUI, RPC, JSON, print)
 * - `/deepseek` command
 * - TUI-only whale badge in the top-right corner (green off-peak, red peak)
 *
 * Set PI_SEEK_WATCH_NOW=<ISO date> to pretend it is that instant (for testing).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerBadge } from "./badge.ts";
import { formatStatus, PRICING_URL, pricingStatus } from "./pricing.ts";

/** The current instant, or PI_SEEK_WATCH_NOW when it holds a valid date. */
function now(): Date {
	const override = process.env.PI_SEEK_WATCH_NOW;
	if (override) {
		const date = new Date(override);
		if (!Number.isNaN(date.getTime())) return date;
	}
	return new Date();
}

const TierSchema = Type.Union([Type.Literal("off-peak"), Type.Literal("peak")]);

const StatusSchema = Type.Object({
	offPeak: Type.Boolean({ description: "True while DeepSeek's off-peak discount applies" }),
	tier: TierSchema,
	nowUtc: Type.String({ description: "ISO timestamp the status was computed for" }),
	nextChangeUtc: Type.String({ description: "ISO timestamp of the next tier change" }),
	nextChangeIn: Type.Number({ description: "Minutes until the next tier change" }),
	nextTier: TierSchema,
	note: Type.String({ description: "Caveat about Chinese public holiday coverage" }),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "deepseek_pricing",
		label: "DeepSeek pricing",
		description:
			"Report whether DeepSeek API pricing is currently off-peak (discounted) or peak (full price), " +
			"and when it next changes. Schedule: peak 01:00-04:00 and 06:00-10:00 UTC Monday-Friday; " +
			"all other hours and all of Saturday/Sunday are off-peak. Chinese public holidays are off-peak " +
			"all day and are modelled from the official State Council holiday calendar; years outside that " +
			"calendar may report peak on holidays (see the note field). Takes no parameters; " +
			"returns offPeak, tier, nowUtc, nextChangeUtc, nextChangeIn (minutes), nextTier and a note. " +
			`Source: ${PRICING_URL}`,
		promptSnippet: "Check whether DeepSeek API pricing is off-peak (discounted) or peak right now",
		promptGuidelines: [
			"Call deepseek_pricing before choosing or delegating to a DeepSeek model for cost-sensitive work, and prefer DeepSeek when it reports offPeak: true.",
			"If deepseek_pricing reports peak and the work can wait, use nextChangeUtc / nextChangeIn to say when the discount starts.",
			"Call deepseek_pricing again rather than reusing an old answer: the tier changes at fixed UTC hours and on Chinese public holidays.",
		],
		parameters: Type.Object({}),
		outputSchema: StatusSchema,
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute() {
			const status = pricingStatus(now());
			return {
				content: [{ type: "text", text: formatStatus(status) }],
				details: status,
				structuredContent: { ...status },
			};
		},
	});

	pi.registerCommand("deepseek", {
		description: "Show whether DeepSeek pricing is off-peak or peak now, and when it changes",
		handler: async (_args, ctx) => {
			const status = pricingStatus(now());
			ctx.ui.notify(formatStatus(status), status.offPeak ? "info" : "warning");
		},
	});

	registerBadge(pi, now);
}
