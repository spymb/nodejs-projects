// 第三章餐厅网站 —— 服务器入口。
//
// 技术栈：Fastify + @fastify/view (EJS) + @fastify/static
// 启动：  node --watch --import tsx server.ts
//
// 分层结构：server.ts（路由/注册）→ data/（纯数据 + 纯函数）→ views/（纯渲染）。
// 营业时间的"今日高亮 / CLOSED"等判断都在 data/operatingHours.ts 中算好，
// 模板只负责展示，不触碰 `new Date()` —— 这就是 MVC 里 Controller 与 View 的分工。

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import Fastify from "fastify";
import view from "@fastify/view";
import fastifyStatic from "@fastify/static";
import ejs from "ejs";

import { menuItems } from "./data/menuItems.js";
import { buildWeekSchedule } from "./data/operatingHours.js";

// ESM 没有 __dirname，用 import.meta.url 计算当前文件所在目录。
// 由于 server.ts 位于项目根，这里得到的正是项目根目录。
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: true, // 启动与每次请求都会打印日志
});

// ── SSR 模板引擎：@fastify/view ───────────────────────────────
// root 使用基于 import.meta.url 的绝对路径，与启动时的工作目录无关。
await app.register(view, {
  engine: { ejs },
  root: join(__dirname, "views"),
  includeViewExtension: true, // reply.view("index") → 渲染 index.ejs
});

// ── 静态资源：@fastify/static ─────────────────────────────────
// 挂载 public/ 到 /public/ 前缀，避免占住根路由 "/"。
await app.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/public/",
});

// ── 路由 ──────────────────────────────────────────────────────

/** 首页：餐厅名称 + 欢迎语。 */
app.get("/", async (_req, reply) => {
  return reply.view("index", {
    title: "诚食 — 首页",
    tagline: "诚实素食佳肴，取自市集新鲜食材。",
  });
});

/** 菜单页：循环渲染所有菜品卡片。 */
app.get("/menu", async (_req, reply) => {
  return reply.view("menu", {
    title: "菜单 — 诚食",
    menuItems,
  });
});

/** 营业时间页：一周 7 天，今日高亮，休息日显示「休息」。 */
app.get("/hours", async (_req, reply) => {
  const now = new Date();
  return reply.view("hours", {
    title: "营业时间 — 诚食",
    schedule: buildWeekSchedule(now),
    todayLabel: now.toLocaleDateString("zh-CN", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  });
});

/** 关于我们页：虚构简介（课后作业）。 */
app.get("/about", async (_req, reply) => {
  return reply.view("about", {
    title: "关于我们 — 诚食",
  });
});

// ── 兜底：404 页面 ─────────────────────────────────────────────
app.setNotFoundHandler((_req, reply) => {
  reply.code(404);
  return reply.view("error", {
    title: "404 — 页面未找到",
  });
});

// ── 启动 ───────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: "127.0.0.1" });
