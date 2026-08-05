# Consume 扩展交接

PI 插件文档：https://pi.dev/docs/latest/extensions

## 当前功能

`index.ts` 统计 AI 每次完整回答的总耗时：

- 首次 `agent_start` 开始计时。
- 后续自动重试或压缩恢复触发的 `agent_start` 不会重置计时。
- 回答过程中底部状态栏持续显示已用时长，每 100ms 刷新一次，格式为 `⏱ 回答计时中 12.3s`，让用户实时看到当前回答已耗时多久。
- `agent_settled` 结束计时，因此耗时包含模型响应、工具调用、自动重试和压缩恢复。
- 通过 `tool_execution_start` / `tool_execution_end` 统计工具调用次数和工具占用总耗时。
- 并行工具调用的重叠时间不会重复累计，保证各项耗时可以直观对比。
- “思考耗时”按“总耗时 - 工具占用总耗时”计算，包含模型响应、Provider 延迟及非工具执行开销，并非模型内部不可观测的纯推理耗时。
- 回答完成后，底部状态栏和通知均按 `总耗时 18.2s · 工具(3) 6.4s · 思考 11.8s` 格式显示。
- `session_shutdown` 清理计时状态和底部状态。

## 使用方式

扩展位于全局自动发现目录 `~/.pi/agent/extensions/consume/index.ts`。在已启动的 pi 中执行 `/reload` 即可加载或刷新。