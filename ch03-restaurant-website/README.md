# 第三章 餐厅网站 — 诚食

> Node.js v22+ | Fastify 5 + EJS + TypeScript (tsx) | 服务端渲染 (SSR)

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [快速开始](#3-快速开始)
4. [路由表](#4-路由表)
5. [目录结构](#5-目录结构)
6. [营业时间分层模型](#6-营业时间分层模型)
7. [课后作业要点](#7-课后作业要点)
8. [验证清单](#8-验证清单)
9. [学习笔记](#9-学习笔记)

---

## 1. 项目概览

一个用 **Fastify + EJS** 构建的服务端渲染餐厅网站，包含四个页面：

- **首页** `/` —— 餐厅名称与欢迎语
- **菜单** `/menu` —— 卡片式展示 8 道菜品（名称、描述、价格）
- **营业时间** `/hours` —— 一周 7 天营业状态，**今日高亮**，休息日显示 CLOSED
- **关于我们** `/about` —— 虚构的餐厅简介

数据全部来自服务端 `data/` 模块；模板只负责渲染，不包含业务逻辑。

---

## 2. 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js v22+ (LTS) | `node --watch` 原生热重载 |
| Web 框架 | fastify@^5 | 性能好、插件生态、原生 TS 友好 |
| 模板引擎 | ejs@^3.1.10 | 配合 `@fastify/view@^10` |
| 静态资源 | `@fastify/static@^8` | 挂载 `public/` 到 `/public/` |
| 语言 | TypeScript + tsx | `node --watch --import tsx` 零构建运行 |

> **热重载**：`pnpm start` 用 `node --watch --import tsx server.ts`——
> 满足"必须用 node --watch"，同时用 tsx 在运行时做 TS 转换，无需预编译。
> 若 `node --watch` 偶发漏监听 `.ts`，可用 `pnpm dev`（`tsx watch`）备选。

---

## 3. 快速开始

```bash
pnpm install   # 安装依赖
pnpm start     # 启动（--watch 热重载）
```

打开 http://127.0.0.1:3000

| 命令 | 作用 |
|------|------|
| `pnpm start` | `node --watch --import tsx server.ts` |
| `pnpm dev` | `tsx watch server.ts`（备选热重载） |
| `pnpm typecheck` | `tsc --noEmit` 类型检查 |
| `pnpm build` | `tsc` 编译到 `dist/` |

---

## 4. 路由表

| 方法 | 路径 | 视图 | 说明 |
|------|------|------|------|
| GET | `/` | `index.ejs` | 首页 |
| GET | `/menu` | `menu.ejs` | 菜单卡片 |
| GET | `/hours` | `hours.ejs` | 营业时间 + 今日高亮 |
| GET | `/about` | `about.ejs` | 关于我们 |
| * | 其他 | `error.ejs` | 404 兜底 |

---

## 5. 目录结构

```
ch03-restaurant-website/
├── server.ts              # 入口：插件注册 + 路由
├── data/
│   ├── menuItems.ts       # 菜品数据（8 道）
│   └── operatingHours.ts  # 营业时间数据 + buildWeekSchedule()
├── views/                 # EJS 模板（每个文件重复 <head>）
│   ├── index.ejs
│   ├── menu.ejs
│   ├── hours.ejs
│   ├── about.ejs
│   └── error.ejs
└── public/
    └── styles.css         # 卡片 grid / 营业时间 flex / today-highlight
```

---

## 6. 营业时间分层模型

营业时间按**优先级**三层组织，例外覆盖默认：

```
dateOverrides (日期例外: "12-25" → null 店休)
    └─> dayOverrides (星期例外: monday → null, sunday → 缩短营业)
         └─> defaultHours (兜底: { open: "11:00", close: "22:00" })
```

`buildWeekSchedule(now)` 是纯函数：接收一个 `Date`，返回一周 7 天
`{ name, open, close, isClosed, isToday }` 数组。**今日高亮**的判断
（`dayOfWeek === now.getDay()`）在服务端完成，模板里没有 `new Date()`。

> JS 的 `Date.getDay()` 返回 **0 = 周日**、1 = 周一……6 = 周六，与中文习惯相反。
> `DAY_ORDER` 用显式的 `dayOfWeek` 字段做了映射，避免下标错位。

---

## 7. 课后作业要点

1. **今日高亮**：`hours.ejs` 中
   `<li class="hours-row <%= day.isToday ? 'today-highlight' : '' %>">`，
   CSS 中 `.hours-row.today-highlight { background: #fef3c7; ... }`。
2. **CLOSED 显示**：`day.isClosed` 为 true 时渲染 `<strong class="closed">CLOSED</strong>`。
3. **/about 页面**：课后加的第二页之外，还多做了 404 兜底页。

---

## 8. 验证清单

```bash
curl -s http://127.0.0.1:3000/                    # 含 "诚食"
curl -s http://127.0.0.1:3000/menu | grep -c menu-card        # 8 张卡片
curl -s http://127.0.0.1:3000/hours | grep -c today-highlight  # 恰好 1 处今日高亮
curl -s http://127.0.0.1:3000/hours | grep -c CLOSED           # 周一店休
curl -s http://127.0.0.1:3000/about | grep -o "About Us"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/public/styles.css  # 200
curl -s http://127.0.0.1:3000/nope | grep -o "404"             # 404 兜底
```

---

## 9. 学习笔记

### 9.1 本节课学了什么

一个完整的**服务端渲染 Web 开发**闭环:

- **SSR + MVC 分层**:`server.ts`(Controller:路由 + 组装数据)→ `data/`(Model:数据 + 纯函数)→ `views/`(View:纯渲染)。
  核心约束:**模板不碰业务逻辑,`new Date()` 永远不出现在 `.ejs` 里**。
- **数据建模**:营业时间用「日期例外 → 星期例外 → 默认」三层覆盖,例外与默认拆开,比混在一个对象里清晰。
- **现代 Node 工程实践**:`node --watch --import tsx` 零构建跑 TS + 原生热重载;数据驱动页面,加菜不改模板。

### 9.2 阅读路径与编写流程

**读(自顶向下,跟数据流)**:跑起来看效果 → README/package.json 建地图 → `server.ts` 建路由表 →
`data/` 问「数据从哪来」→ `views/` 看「数据怎么被消费」→ 验证清单回查。
一句话:**一次请求的数据如何从 `data/` 流经 `server.ts` 再到 `views/`**。

**写(自底向上,数据先行)**:需求 → 脚手架 → **数据层先定形状** → 路由组装 → 模板最后填 → 样式验证。
数据层是纯函数 + 纯数据、不依赖框架,可独立写独立测,是整站地基;模板因为数据形状已定死,
只剩纯填充,不会「写一半发现数据对不上」。

### 9.3 关键知识点与踩坑记录

- **`reply.view(page, data)`**:第二个参数完全自定义,每个路由传的结构都不一样;
  模板字段必须与之一一对应,对不上只渲染空串、**不报错**,是调试时易踩的坑。
- **Fastify handler 必须 `return reply.view(...)`**:异步插件模型,漏 return 响应可能不发送。
- **`Object.hasOwn` vs `in`**:只查对象自身属性、不污染原型链,同时帮 TS 把取值收窄为
  `HoursOverride`(无 undefined),`in` 做不到。
- **`Date.getDay()` 返回 0 = 周日**:与中文习惯相反,用显式 `dayOfWeek` 字段映射避免下标错位。
- **`@fastify/static` 必须显式 `prefix`**:本项目挂 `/public/`,否则会占住根路由 `/`。

### 9.4 Express → Fastify 对比(背景:之前用过 Express)

| 维度 | Express | Fastify |
|------|---------|---------|
| 哲学 | 极简中间件链,一切皆 `app.use` | 高性能 + 插件系统 + schema 校验 |
| 功能加载 | `app.set` / `app.use` 全局配置 | 插件 `await register()`,作用域可隔离 |
| 404 | 靠注册顺序(最后注册生效) | `setNotFoundHandler` 显式 API |
| 路由签名 | `(req, res)` | `async (request, reply)` 且必须 `return reply` |
| 静态资源 | `express.static` 自动挂载 | 必须显式 `prefix` |
| 日志 | 需另装 `morgan` | `logger: true` 自带 Pino |
| 入参校验 | 手写判断 | 内置 JSON schema 自动校验 + 类型收窄 |

> 最大思维转变:**「中间件思维 → 插件思维」**。Fastify 5 不再直接支持 `app.use()`,
> 扩展功能要封装成插件;`reply` 必须显式返回、一次请求只能 `send` 一次。

#### 响应模型的差异:`send / end / return`

**Express 的 `res.send()` 是「发送并结束」,不需要再补 `res.end()`**:

| Express 方法 | 作用 | 需要补 `end` 吗 |
|--------------|------|----------------|
| `res.send()` | 发送内容 **并结束**响应 | ❌ 不需要 |
| `res.json()` | 发 JSON **并结束** | ❌ 不需要 |
| `res.render()` | 渲染模板 **并结束** | ❌ 不需要 |
| `res.write()` | 只写数据、**不结束**(流式) | ✅ 必须手动 `res.end()` |
| `res.end()` | 只结束、不带 body | —— |

Express 采用**命令式**响应模型:`send/json/render` 都是一步到位,内部已调用 `end()`。
**只有**进入流式 `res.write()` 时才需要手动 `end()`。另外 Express 有**隐式 end 兜底**——
handler 执行完若未发送,会自动 `res.end()` 返回空响应;但重复 `send()` 会报
`ERR_HTTP_HEADERS_SENT`。

**Fastify 是函数式**:handler 的 `return` 值就是响应,自动序列化发送(对象 → JSON),
等价于 Express 的「send + end」两个动作。所以:

```ts
// Express:必须显式 res.send();返回值是摆设
app.get("/hello", (_req, res) => {
  res.send("Hello");        // ✅ send 本身已含 end
});

// Fastify:一个 return 就是完整响应
app.get("/hello", async () => {
  return { hello: "world" };  // ✅ 自动 JSON 响应
});
```

> 一句话记忆:**`send()` = 发送并结束,`end()` = 只结束**。Express 大多用 `send()` 一步到位,
> 只有流式 `write()` 才补 `end()`;Fastify 则**一个 `return` 全覆盖**。
> 两者的共同点:**一次请求只能发送一次响应**。

#### 模板渲染:`render` vs `view`(同一件事,两种哲学)

`res.render()` 和 `reply.view()` 做的**是同一件事**:渲染模板 + 把结果作为响应发送。
差别全在框架哲学上:

| 维度 | Express `res.render()` | Fastify `reply.view()` |
|------|------------------------|------------------------|
| 发送语义 | 命令式,内部自动 `end()`,**不用 return** | 函数式,**必须 `return`** 才完成响应 |
| 配置方式 | `app.set("view engine", "ejs")` + `app.set("views", ...)` 全局配置 | `await app.register(view, {...})` 插件参数化配置 |
| 扩展名推断 | 由 `view engine` 全局推断,`"index"` → `index.ejs` | 由 `includeViewExtension: true` 决定,不设得写 `"index.ejs"` |
| views 目录 | 相对路径即可,较宽松 | `root` 用**绝对路径**(基于 `import.meta.url`),与启动目录无关 |
| 拿到渲染字符串 | 第三参回调 `res.render(view, data, cb)` 拿到 HTML 不发送 | 无回调;想拿字符串需直接调引擎 `ejs.render()` |
| 状态码/链式 | `res.status(404).render("error")` 一行搞定 | 先 `reply.code(404)`,再 `return reply.view("error")` |
| locals 分层 | 有 `app.locals` / `res.locals` / 每请求 locals 三层 | 无三层概念,数据就一个对象直接注入模板 |

```ts
// Express:命令式,调了就发,自动 end
app.get("/hours", (_req, res) => {
  res.render("hours", { schedule: buildWeekSchedule(new Date()) });
});

// Fastify:函数式,必须显式 return
app.get("/hours", async (_req, reply) => {
  return reply.view("hours", { schedule: buildWeekSchedule(now) });
});
```

模板侧两者完全相同:直接消费路由传入的字段(`<%= title %>` / `<% schedule.forEach(...) %>`),
区别只在注入前——Express 会 merge 进 `res.locals`(可被中间件追加),Fastify 只认 handler
传的那一个对象,契合它「数据组装在 handler、模板只消费」的 MVC 分层风格。

> 迁移时唯一要改的肌肉记忆:**记得加 `return`**(不 return 时响应可能不发送)。
