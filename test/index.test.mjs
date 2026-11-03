import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import extension from "../index.ts";

test("累计输出 token、排除并行工具耗时，并在回答结束和退出时重置", (t) => {
	let now = 0;
	t.mock.method(performance, "now", () => now);
	const handlers = new Map();
	const notifications = [];
	let status;
	const ctx = {
		ui: {
			theme: { fg: (_color, text) => text },
			setStatus: (_id, text) => { status = text; },
			notify: (text) => notifications.push(text),
		},
	};
	extension({ on: (name, handler) => handlers.set(name, handler) });
	const emit = (name, event = {}) => handlers.get(name)(event, ctx);
	t.after(() => emit("session_shutdown"));

	// 回答外的消息不计入；同一次回答跨 agent_start（自动重试）继续累计。
	emit("message_end", { message: { role: "assistant", usage: { output: 999 } } });
	emit("agent_start");
	now = 1000;
	emit("message_end", { message: { role: "assistant", usage: { output: 100 } } });
	emit("tool_execution_start", { toolCallId: "a" });
	now = 2000;
	emit("tool_execution_start", { toolCallId: "b" });
	now = 3000;
	emit("tool_execution_end", { toolCallId: "a" });
	now = 4000;
	emit("tool_execution_end", { toolCallId: "b" });
	emit("message_end", { message: { role: "toolResult", usage: { output: 999 } } });
	emit("agent_start");
	now = 5000;
	emit("message_end", { message: { role: "assistant", usage: { output: 200 } } });
	emit("agent_settled");
	assert.equal(notifications.at(-1), "AI 本次回答：总耗时 5.0s · 工具(2) 3.0s · 思考 2.0s · Token 速度 150.0 tok/s");
	assert.equal(status, `⏱ ${notifications.at(-1).replace("AI 本次回答：", "")}`);

	// 缺失/无效 usage、零输出或零耗时，不显示误导性的速度。
	for (const output of [undefined, NaN, Infinity, -1, 0, 100]) {
		emit("agent_start");
		emit("message_end", { message: { role: "assistant", usage: output === undefined ? undefined : { output } } });
		if (output !== 100) now += 1000;
		emit("agent_settled");
		assert.ok(notifications.at(-1).endsWith("Token 速度 —"));
	}

	emit("agent_start");
	emit("message_end", { message: { role: "assistant", usage: { output: 999 } } });
	emit("session_shutdown");
	assert.equal(status, undefined);
	emit("agent_start");
	now += 2000;
	emit("message_end", { message: { role: "assistant", usage: { output: 50 } } });
	emit("agent_settled");
	assert.ok(notifications.at(-1).endsWith("Token 速度 25.0 tok/s"));
});
