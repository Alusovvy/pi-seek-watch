import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { Value } from "typebox/value";
import { registerBadge } from "../src/badge.ts";
import extension from "../src/index.ts";

/** Just enough of pi's ExtensionAPI to record what the extension registers. */
function fakePi() {
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();
	const pi = {
		registerTool: (tool: any) => tools.set(tool.name, tool),
		registerCommand: (name: string, command: any) => commands.set(name, command),
		on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
	};
	const emit = (event: string, ctx: unknown) => {
		for (const handler of handlers.get(event) ?? []) handler({ type: event }, ctx);
	};
	return { pi: pi as any, tools, commands, emit };
}

/** A TUI context whose ui.custom builds the component the way pi does. */
function fakeTuiCtx() {
	const overlays: Array<{ render(): string[]; closed: boolean; options: any }> = [];
	const renders: number[] = [];
	const tui = { requestRender: () => renders.push(Date.now()) };
	const theme = { fg: (color: string, text: string) => `<${color}>${text}` };
	const ctx = {
		mode: "tui",
		ui: {
			custom: (factory: any, options: any) =>
				new Promise<void>((resolve) => {
					const overlay = { closed: false, options, render: () => [] as string[] };
					const component = factory(tui, theme, {}, () => {
						overlay.closed = true;
						resolve();
					});
					overlay.render = () => component.render();
					overlays.push(overlay);
				}),
		},
	};
	return { ctx, overlays, renders };
}

describe("deepseek_pricing tool", () => {
	beforeEach(() => {
		process.env.PI_SEEK_WATCH_NOW = "2026-10-23T09:12:00Z"; // Friday, peak
	});
	afterEach(() => {
		delete process.env.PI_SEEK_WATCH_NOW;
	});

	it("returns text, details and structuredContent matching outputSchema", async () => {
		const { pi, tools } = fakePi();
		extension(pi);
		const tool = tools.get("deepseek_pricing");
		const result = await tool.execute();

		assert.match(result.content[0].text, /PEAK \(full price\)/);
		assert.equal(result.details.nextChangeUtc, "2026-10-23T10:00:00.000Z");
		assert.equal(result.details.nextChangeIn, 48);
		assert.deepEqual(result.structuredContent, result.details);
		assert.equal(Value.Check(tool.outputSchema, result.structuredContent), true);
	});

	it("ignores an invalid PI_SEEK_WATCH_NOW", async () => {
		process.env.PI_SEEK_WATCH_NOW = "not a date";
		const { pi, tools } = fakePi();
		extension(pi);
		const { details } = await tools.get("deepseek_pricing").execute();
		assert.ok(Math.abs(Date.parse(details.nowUtc) - Date.now()) < 5_000);
	});

	it("/deepseek notifies with a warning at peak and info off-peak", async () => {
		const { pi, commands } = fakePi();
		extension(pi);
		const notes: Array<[string, string]> = [];
		const ctx = { ui: { notify: (text: string, level: string) => notes.push([text, level]) } };

		await commands.get("deepseek").handler("", ctx);
		process.env.PI_SEEK_WATCH_NOW = "2026-10-24T08:00:00Z"; // Saturday
		await commands.get("deepseek").handler("", ctx);

		assert.equal(notes[0][1], "warning");
		assert.equal(notes[1][1], "info");
		assert.match(notes[1][0], /OFF-PEAK/);
	});
});

describe("whale badge", () => {
	beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-10-23T09:59:00Z") }));
	afterEach(() => mock.timers.reset());

	it("is not drawn outside the TUI", () => {
		const { pi, emit } = fakePi();
		registerBadge(pi, () => new Date());
		const { ctx, overlays } = fakeTuiCtx();
		emit("session_start", { ...ctx, mode: "rpc" });
		assert.equal(overlays.length, 0);
	});

	it("is a non-capturing top-right overlay that turns green at the tier change", () => {
		const { pi, emit } = fakePi();
		registerBadge(pi, () => new Date());
		const { ctx, overlays, renders } = fakeTuiCtx();
		emit("session_start", ctx);

		assert.equal(overlays.length, 1);
		assert.equal(overlays[0].options.overlay, true);
		assert.equal(overlays[0].options.overlayOptions.nonCapturing, true);
		assert.equal(overlays[0].options.overlayOptions.anchor, "top-right");
		assert.match(overlays[0].render()[0], /^<error>/);

		mock.timers.tick(60_000);
		assert.equal(renders.length, 0); // redraws 250 ms after 10:00 UTC
		mock.timers.tick(250);
		assert.equal(renders.length, 1);
		assert.match(overlays[0].render()[0], /^<success>/);
	});

	it("closes its overlay and stops redrawing on session_shutdown", () => {
		const { pi, emit } = fakePi();
		registerBadge(pi, () => new Date());
		const { ctx, overlays, renders } = fakeTuiCtx();
		emit("session_start", ctx);
		emit("session_shutdown", ctx);

		assert.equal(overlays[0].closed, true);
		mock.timers.tick(24 * 60 * 60_000);
		assert.equal(renders.length, 0);
	});

	it("keeps a single whale when a session starts again", () => {
		const { pi, emit } = fakePi();
		registerBadge(pi, () => new Date());
		const { ctx, overlays } = fakeTuiCtx();
		emit("session_start", ctx);
		emit("session_start", ctx);

		assert.equal(overlays.length, 2);
		assert.deepEqual(
			overlays.map((o) => o.closed),
			[true, false],
		);
	});
});
