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

预览和正式部署不会自动使用开发代理。需要将 `/api`（含图片预览地址）反向代理至后端，并为 `/api/ws/chat` 支持 WebSocket Upgrade，或者在构建前设置 `VITE_CHAT_WS_URL`（完整的 `ws://` 或 `wss://` 地址）和 `VITE_IMAGE_UPLOAD_URL`（默认 `/api/images`，跨域时后端需配置 CORS）。HTTPS 页面请使用 `wss://` 和 HTTPS 上传接口；环境变量修改后需重启开发服务或重新构建。这些变量是公开配置，不能放密钥。

## 聊天协议

实际后端路由包含 `/api` 前缀：`/api/ws/chat`。

发送：

```json
{"message":"想钓鲫鱼，该怎么搭配饵料？"}
```

选择图片后立即通过 `POST /api/images` 上传，使用 `multipart/form-data` 的 `file` 字段（浏览器自动生成 Content-Type boundary）。成功响应约定为：

```json
{"image_id":"image-123","preview_url":"/api/images/image-123"}
```

`preview_url` 必须是可访问的 HTTP(S) 地址，或相对于上传接口的 URL。全部图片上传成功后才允许发送，附图消息格式为：

```json
{"message":"看看这里怎么选钓位","image_ids":["image-123"]}
```

仅图片消息发送 `message: ""` 和非空 `image_ids`；纯文字消息保留原有格式。不发送 `conversation_id`。后端需要解析并使用 `image_ids`，仅支持文字的后端不会自动获得识图能力。

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
- 支持最多 3 张 JPEG、PNG、WebP 图片，每张不超过 10 MB；拒绝空文件。提供本地预览、移除、上传状态、失败详情和逐张重试，上传请求 60 秒超时。失败或上传中不可发送，可移除图片继续文字聊天。
- 上传或发送失败保留草稿；上传成功后聊天断线只需重连，无需重新上传。删除、新对话、离开页面会中止待完成上传并释放本地对象 URL；已发送消息使用服务端预览 URL。
- 删除草稿图片只清理本地状态，不删除服务端文件；服务端需自行处理未发送图片的过期清理。
- 后端图片接口尚未实现时直接显示失败，不模拟成功。联调需确认上传响应、图片预览访问、WebSocket 仅图片消息和识图结果。
- 消息仅保存在当前页面内存，刷新即清空。
