---
title: 项目
icon: code
dir:
  text: 项目
  icon: cube
  order: 3
---


## 个人作品

<VPBanner
  title="ai-resume-chat"
  content="一个 AI 问答 Web 应用"
  logo="/avatar.jpg"
  :actions='[
    { text: "在线预览", link: "https://ai-resume-chat-blue.vercel.app", type: "primary" },
    { text: "源码", link: "https://github.com/shierhen/ai-resume-chat" }
  ]'
/>

## 技术选型

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3.5（`<script setup>` + 组合式 API） | 组合式函数按功能组织逻辑 |
| 语言 | TypeScript（strict） | 前后端共享类型定义 |
| 构建 | Vite 8 | 秒级冷启动、HMR |
| UI 库 | Element Plus 2.x | **按需引入**（unplugin-vue-components） |
| 样式 | 原生 CSS + CSS 变量 | 零额外依赖，主题切换靠变量重绑定 |
| Markdown | marked + highlight.js（core 按需）+ DOMPurify | 渲染 + 高亮 + XSS 清洗 |
| 后端 | Vercel Serverless Function（Node 运行时） | 保管 API Key、翻译 SSE、流式转发 |
| 部署 | Vercel | 推 GitHub 自动部署，支持 Preview 环境 |


## 界面预览

![界面截图](/aipreview.png)


## 踩坑记录（真实故障 + 根因）

### 1. 线上 `FUNCTION_INVOCATION_FAILED`：函数不能引用 `api/` 之外的文件

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/utils/sse.ts'
    imported from /var/task/api/chat.js
```

**根因**：Vercel 部署函数时，只把 `api/` 目录放进函数的运行文件系统（`/var/task/api/…`），
`src/` 不会一起带进去；而 ESM `import` 是**运行时解析**的，于是找不到模块。
本地能跑，是因为本地有完整项目目录（且 Node 24 原生支持直接运行 `.ts`）。

**解法**（本项目采用）：在 `api/` 内放置自包含副本，并**把 import 扩展名写成 `.js`**：

```ts
import { consumeSse, encodeSseJson } from './_sse.js'   // ← 写 .js，不是 .ts
```

因为 Vercel 会把 `api/_sse.ts` 转译成 `api/_sse.js` 放在同目录，运行时即可解析到。

### 2. 推理模型的增量字段不是 `content`

思考链增量在某些厂商是 `delta.reasoning`，某些是 `delta.reasoning_content`。
只解析 `delta.content` 会导致**整段输出丢失、界面空白**（实测踩过）。
代码用 `delta.reasoning ?? delta.reasoning_content` 双字段兜底。

### 3. 流的 `cancel()` 里不能取消已锁定的流

客户端断开时若执行 `upstreamBody.cancel()`，会抛 `ERR_INVALID_STATE: ReadableStream is locked`
（该流已被 `consumeSse` 的 reader 锁定）；异常发生在取消回调里会变成未捕获拒绝，**直接把 Node 进程带崩**。
正确做法：`upstreamController.abort()`，让进行中的 `read()` 以 `AbortError` 结束，由 `finally` 释放锁。

## 疑问解答

| 渠道 | 地址 |
| --- | --- |
| GitHub | [github.com/shierhen](https://github.com/shierhen/ai-resume-chat) |
| 邮箱 | [1958392643@qq.com](mailto:1958392643@qq.com) |

::: tip 关于提问
技术问题欢迎直接开issue。不过如果能先说明**你的环境和已经试过什么**，我们都能省不少时间 😄
:::

---

