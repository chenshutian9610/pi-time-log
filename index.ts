import { performance } from "node:perf_hooks";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATUS_ID = "ai-response-time";

function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;

	const totalSeconds = milliseconds / 1000;
	if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;

	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}m ${seconds}s`;
}

export default function (pi: ExtensionAPI) {
	let responseStartedAt: number | undefined;
	let toolPhaseStartedAt: number | undefined;
	let toolDurationMs = 0;
	let toolCallCount = 0;
	const activeToolCallIds = new Set<string>();

	const resetTiming = () => {
		responseStartedAt = undefined;
		toolPhaseStartedAt = undefined;
		toolDurationMs = 0;
		toolCallCount = 0;
		activeToolCallIds.clear();
	};

	pi.on("agent_start", (_event, ctx) => {
		// 自动重试或压缩恢复可能再次触发 agent_start，保留首次开始时间才能得到总耗时。
		if (responseStartedAt !== undefined) return;

		resetTiming();
		responseStartedAt = performance.now();
		ctx.ui.setStatus(STATUS_ID, ctx.ui.theme.fg("dim", "⏱ 回答计时中"));
	});

	pi.on("tool_execution_start", (event) => {
		if (responseStartedAt === undefined || activeToolCallIds.has(event.toolCallId)) return;

		if (activeToolCallIds.size === 0) toolPhaseStartedAt = performance.now();
		activeToolCallIds.add(event.toolCallId);
		toolCallCount++;
	});

	pi.on("tool_execution_end", (event) => {
		if (responseStartedAt === undefined || !activeToolCallIds.delete(event.toolCallId)) return;

		// 并行工具从第一个开始计时，到最后一个结束，避免重复累计重叠时间。
		if (activeToolCallIds.size === 0 && toolPhaseStartedAt !== undefined) {
			toolDurationMs += performance.now() - toolPhaseStartedAt;
			toolPhaseStartedAt = undefined;
		}
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (responseStartedAt === undefined) return;

		const responseEndedAt = performance.now();
		if (toolPhaseStartedAt !== undefined) {
			toolDurationMs += responseEndedAt - toolPhaseStartedAt;
		}

		const totalDurationMs = responseEndedAt - responseStartedAt;
		// Pi 无法观测模型内部推理，思考耗时按总耗时减去工具占用时间计算。
		const thinkingDurationMs = Math.max(0, totalDurationMs - toolDurationMs);
		const totalDuration = formatDuration(totalDurationMs);
		const toolDuration = formatDuration(toolDurationMs);
		const thinkingDuration = formatDuration(thinkingDurationMs);
		const summary = `总耗时 ${totalDuration} · 工具(${toolCallCount}) ${toolDuration} · 思考 ${thinkingDuration}`;

		resetTiming();
		ctx.ui.setStatus(STATUS_ID, ctx.ui.theme.fg("dim", `⏱ ${summary}`));
		ctx.ui.notify(`AI 本次回答：${summary}`, "info");
	});

	pi.on("session_shutdown", (_event, ctx) => {
		resetTiming();
		ctx.ui.setStatus(STATUS_ID, undefined);
	});
}
