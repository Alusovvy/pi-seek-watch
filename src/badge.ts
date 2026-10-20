/**
 * TUI badge: a small DeepSeek whale in the top-right corner,
 * green at off-peak price, red at peak, refreshed at each tier change.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isOffPeak, nextChange } from "./pricing.ts";

/** Classic ASCII whale (DeepSeek's mascot), every line is 9 columns wide. */
const WHALE: string[] = [
	'  .-""-. ',
	' / o  o \\',
	"  `-..-' ",
];

export function registerBadge(pi: ExtensionAPI, now: () => Date): void {
	let tui: { requestRender(force?: boolean): void } | null = null;
	let boundaryTimer: ReturnType<typeof setTimeout> | null = null;

	function clearTimer() {
		if (boundaryTimer) {
			clearTimeout(boundaryTimer);
			boundaryTimer = null;
		}
	}

	function scheduleBoundaryRefresh() {
		clearTimer();
		const at = now();
		// Land just past the boundary so the color has flipped.
		const ms = nextChange(at).getTime() - at.getTime() + 250;
		boundaryTimer = setTimeout(() => {
			tui?.requestRender();
			scheduleBoundaryRefresh();
		}, ms);
	}

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		// Non-capturing overlay: floats in the corner without stealing focus.
		void ctx.ui
			.custom(
				(t, theme) => {
					tui = t;
					return {
						render(): string[] {
							const color = isOffPeak(now()) ? "success" : "error";
							return WHALE.map((line) => theme.fg(color, line));
						},
						invalidate() {},
					};
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "top-right",
						nonCapturing: true,
						width: 9,
						margin: { top: 0, right: 1 },
					},
				},
			)
			.catch(() => {});

		scheduleBoundaryRefresh();
	});

	pi.on("session_shutdown", () => {
		clearTimer();
		tui = null;
	});
}
