# 钓鱼 AI 助手前端

React + TypeScript + Vite 聊天页面，通过 WebSocket 接入 Python 后端。

## 开发

先在 backend 目录启动服务（默认 127.0.0.1:8000）：

```bash
uv run fastapi dev
```

再在 frontend 目录执行：

```bash
npm install
npm run dev
```

Vite 将 `/api` 的 HTTP 和 WebSocket 请求代理到 `http://127.0.0.1:8000`。修改代理配置后需重启前端开发服务。

```bash
npm run build
npm run preview
```

预览和正式部署不会自动使用开发代理。需要将 `/api/ws/chat` 反向代理至后端并支持 WebSocket Upgrade，或者在构建前设置 `VITE_CHAT_WS_URL`（完整的 `ws://` 或 `wss://` 地址）。HTTPS 页面请使用 `wss://`；环境变量修改后需重启开发服务或重新构建。该变量是公开配置，不能放密钥。

## 聊天协议

实际后端路由包含 `/api` 前缀：`/api/ws/chat`。

发送：

```json
{"message":"想钓鲫鱼，该怎么搭配饵料？"}
```

接收增量文本，并在 `done` 后允许发送下一条：

```json
{"type":"message","payload":{"role":"assistant","content":"可以先告诉我"}}
{"type":"message","payload":{"role":"assistant","content":"你的作钓环境吗？"}}
{"type":"done","payload":{}}
```

- 支持增量拼接、等待回复、连接状态、断线提示和手动重连。
- 连接中或回复中不允许重复发送；新对话会清空页面并重建连接，忽略旧连接的回复。
- 断线不自动重发消息，以免重复调用模型；已收到的部分回复会保留。
- Enter 发送，Shift + Enter 换行，兼容中文输入法。
- 后端当前每次只处理当前问题，尚未保存多轮上下文。
- 保留最多 3 张图片的本地预览（JPG、PNG、WebP、GIF，每张不超过 10 MB）；当前接口仅支持文字，附图时会提示移除，避免图片被静默丢弃。
- 消息仅保存在当前页面内存，刷新即清空。
