# Consume 扩展交接

PI 插件文档：https://pi.dev/docs/latest/extensions

## 当前功能

`index.ts` 统计 AI 每次完整回答的总耗时：

- 首次 `agent_start` 开始计时。
- 后续自动重试或压缩恢复触发的 `agent_start` 不会重置计时。
- 回答过程中底部状态栏持续显示已用时长，每 100ms 刷新一次，并在“回答计时中”后展示当前用户问题的前 10 个字符；超过 10 个字符追加 `...`，格式为 `⏱ 回答计时中 当前用户问题... · 12s`。
- `agent_settled` 结束计时，因此耗时包含模型响应、工具调用、自动重试和压缩恢复。
- 通过 `tool_execution_start` / `tool_execution_end` 统计工具调用次数和工具占用总耗时。
- 并行工具调用的重叠时间不会重复累计，保证各项耗时可以直观对比。
- “思考耗时”按“总耗时 - 工具占用总耗时”计算，包含模型响应、Provider 延迟及非工具执行开销，并非模型内部不可观测的纯推理耗时。
- 通过 `message_end` 累加本次回答中所有 assistant 消息的 `usage.output`，不计输入 token 和工具结果；跨自动重试继续累计，结束或退出时重置。
- Token 速度 = 累计输出 token ÷ 非工具耗时（即上面的“思考耗时”，换算为秒），保留 1 位小数。包含请求等待、重试等开销，不是纯生成速度；推理 token 是否计入取决于 Provider 的 `usage.output` 口径。没有有效正数输出 token 或非工具耗时为零时显示 `—`。
- 回答完成后，底部状态栏和通知均按 `总耗时 18.2s · 工具(3) 6.4s · 思考 11.8s · Token 速度 42.3 tok/s` 格式显示。
- `session_shutdown` 清理计时状态和底部状态。

## 使用方式

扩展位于全局自动发现目录 `~/.pi/agent/extensions/pi-time-log/index.ts`。在已启动的 pi 中执行 `/reload` 即可加载或刷新。

## 验证

执行 `node --test test/index.test.mjs`（Node 需支持直接加载 TypeScript）。通过模拟事件与时钟验证多轮 token 累计、并行工具耗时排除、重试保留、无效 usage/零耗时及状态重置；已通过，尚未进行真实 Provider/TUI 验证。