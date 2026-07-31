# 第二章 CLI 数据转换器 — Contacts to CSV

> Node.js v22+ | ESM + TypeScript | 零外部依赖（仅 dev）

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈与约束](#2-技术栈与约束)
3. [模块拆解](#3-模块拆解)
   - [3.1 ESM 路径处理](#31-esm-路径处理)
   - [3.2 readline/promises 交互式输入](#32-readlinepromises-交互式输入)
   - [3.3 fs/promises 异步文件操作](#33-fspromises-异步文件操作)
   - [3.4 输入校验](#34-输入校验)
   - [3.5 CSV 序列化](#35-csv-序列化)
   - [3.6 主循环与流程控制](#36-主循环与流程控制)
   - [3.7 错误处理与退出码](#37-错误处理与退出码)
4. [TypeScript 类型设计](#4-typescript-类型设计)
5. [API 速查表](#5-api-速查表)
6. [正则表达式速查](#6-正则表达式速查)
7. [关键设计模式](#7-关键设计模式)
8. [常见问题](#8-常见问题)

---

## 1. 项目概览

构建一个命令行交互工具，循环提示用户输入联系人信息（姓名、电话、邮箱），校验通过后追加写入 `contacts.csv` 文件。

**交互流程：**

```
📇  命令行联系人管理器
请输入联系人信息。 按 Ctrl+C 可随时退出。

Name: Alice
Phone: 123-456-7890
Email: alice@example.com
✅ 联系人已保存！

是否继续？(y/N): y

Name: Bob
...
是否继续？(y/N): n
👋 再见！
```

---

## 2. 技术栈与约束

| 约束项 | 要求 | 原因 |
|--------|------|------|
| Runtime | Node.js v22+ | LTS 版本，原生支持 ESM |
| 模块系统 | `"type": "module"` | 现代标准，替代 CommonJS |
| 交互输入 | `node:readline/promises` | 原生异步，禁止 `inquirer` 等第三方包 |
| 文件操作 | `node:fs/promises` | 异步非阻塞，禁止 `xxxSync` 方法 |
| 语言 | TypeScript (strict) | 类型安全 |
| 运行时 | `tsx` | 无需编译，直接执行 `.ts` 文件 |

> **核心原则**：Node.js 单线程，任何 `sync` 方法都会阻塞事件循环。用异步 API 是 Node 性能模型的基础。

---

## 3. 模块拆解

### 3.1 ESM 路径处理

**问题**：ESM 不再提供 `__dirname` 和 `__filename`（CommonJS 专属）。

**解决**：

```ts
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
```

**调用链**：

```
import.meta.url                        "file:///D:/project/index.ts"
  │
  └─ fileURLToPath()                   "D:\project\index.ts"
       │
       └─ dirname()                    "D:\project"
```

> `import.meta.url` 是 ESM 中获取当前模块 URL 的元信息，不是路径，需要用 `fileURLToPath` 转换。

---

### 3.2 readline/promises 交互式输入

```ts
import * as readline from "node:readline/promises";

const rl = readline.createInterface({
  input: process.stdin,    // 键盘输入流
  output: process.stdout,  // 屏幕输出流
});

const answer = await rl.question("你的名字: ");
// 打印 "你的名字: "，等待用户输入回车，返回输入的字符串

rl.close();  // 必须手动关闭，否则进程不会退出
```

**工作原理**：

```
rl.question("Name: ")
     │
     ├─ 向 output 写入 "Name: "           ← 屏幕显示提示
     ├─ 监听 input 流，等待 '\n'           ← 等待用户按回车
     └─ resolve(输入内容)                   ← Promise 完成
```

**`node:` 前缀**：明确标识内置模块，区别于 npm 包 `readline`。Node.js 12+ 支持该协议。

---

### 3.3 fs/promises 异步文件操作

#### access() — 检查文件是否存在

```ts
try {
  await access("/path/to/file.csv");
  // 文件存在，什么都不做
} catch {
  // 文件不存在 → 创建
  await appendFile("/path/to/file.csv", "NAME,PHONE,EMAIL\n");
}
```

> 这种 "先试再兜底"（EAFP: Easier to Ask Forgiveness than Permission）比 "先判断再操作"（LBYL）更可靠：判断和操作之间存在时间差，文件状态可能被其他进程改变。

#### appendFile() — 追加写入

```ts
await appendFile("contacts.csv", "Alice,123,alice@ex.com\n", "utf-8");
```

- 文件不存在 → **自动创建**
- 文件已存在 → 在末尾追加
- 第三个参数 `"utf-8"` 指定编码（默认值，可省略但建议保留以明确意图）

---

### 3.4 输入校验

#### 校验模式

```ts
type Validator = (input: string) => string | null;
//                                          ^^^^
//                              null = 校验通过
//                              string = 失败，返回值是错误提示
```

`null` 与 `string` 的区分天然表达了"通过/失败"，无需额外的 `{ valid: boolean, error?: string }` 包装。

#### 三个校验正则

| 字段 | 正则 | 允许 | 拦截 |
|------|------|------|------|
| Name | 无（只判空） | —— | `""` `"  "` |
| Phone | `^[+\-\s]*\d[+\-\d\s]*$` | `+86-138`, `123 456` | `abc`, `---`（无数字） |
| Email | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `a@b.c` | `notanemail`, `a@b` |

#### 校验失败的处理：重新询问，不退出

```ts
while (true) {
  const answer = await rl.question("Phone: ");
  const error = validatePhone(answer);
  if (error) {
    console.log(`❌ ${error}`);   // 提示错误
    // 不 break，继续循环 → 重新询问
  } else {
    return answer;                // 校验通过，退出循环
  }
}
```

> **UX 设计原则**：用户输入错误时，重新让用户输入当前字段，而不是从头开始或直接退出程序。

---

### 3.5 CSV 序列化

#### 转义规则

CSV 格式中，值如果包含**逗号**或**双引号**，必须用双引号包裹，内部双引号加倍：

```ts
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

| 输入 | 输出 |
|------|------|
| `Alice` | `Alice` |
| `Doe, John` | `"Doe, John"` |
| `He said "hi"` | `"He said ""hi"""` |

#### 文件结构

```
NAME,PHONE,EMAIL              ← 表头（首次运行时自动创建）
Alice,123,alice@ex.com        ← 数据行
Bob,+86-138,bob@test.org
```

---

### 3.6 主循环与流程控制

```ts
// 数据驱动：字段配置集中管理
const FIELDS = [
  { key: "name",  prompt: "Name: ",  validate: validateName },
  { key: "phone", prompt: "Phone: ", validate: validatePhone },
  { key: "email", prompt: "Email: ", validate: validateEmail },
];

while (running) {
  // 逐字段收集（顺序执行，每个字段内置重试循环）
  const contact: Contact = {
    name:  await promptField(rl, FIELDS[0]),
    phone: await promptField(rl, FIELDS[1]),
    email: await promptField(rl, FIELDS[2]),
  };

  await appendContact(contact);  // 写入文件

  const again = await rl.question("是否继续？(y/N): ");
  if (again !== "y") running = false;  // 默认 N
}
```

**`y/N` 的含义**：大写 `N` 表示默认值——用户直接回车等于选择 `N`（退出）。

---

### 3.7 错误处理与退出码

#### 三层错误处理

```
promptField()        ← 内层：校验失败 → 循环重试（不抛异常）
     │
main() try/catch     ← 中层：stdin 关闭 / Ctrl+C → 静默退出（捕获特定异常）
     │
main().catch()       ← 外层：致命错误（磁盘满、权限拒绝）→ 打印 + exit(1)
```

#### process.exit() 的作用

```
exit(0) → 成功  → shell 的 && 继续执行
exit(1) → 失败  → shell 的 && 停止，|| 触发
```

退出码是命令行程序之间通信的通用语言——CI/CD、npm scripts、定时任务都依赖它判断成败。

---

## 4. TypeScript 类型设计

```ts
// 数据模型
interface Contact {
  name: string;
  phone: string;
  email: string;
}

// 函数签名别名
type Validator = (input: string) => string | null;
//               ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^
//               接收字符串         返回错误信息或 null

// 字段配置（数据驱动模式的核心类型）
interface FieldConfig {
  key: keyof Contact;     // "name" | "phone" | "email" —— 编译期约束
  prompt: string;         // 提示文字
  validate: Validator;    // 校验函数
}
```

**`keyof` 运算符**：取对象类型的所有键名组成的联合类型。`keyof Contact` → `"name" | "phone" | "email"`，确保 `key` 不会写错。

---

## 5. API 速查表

| API | 模块 | 用途 |
|-----|------|------|
| `createInterface({input, output})` | `readline` | 创建命令行问答接口 |
| `rl.question(prompt)` | `readline/promises` | 显示提示，等待输入，返回 Promise\<string\> |
| `rl.close()` | `readline` | 关闭接口，释放 stdin/stdout |
| `appendFile(path, data, enc?)` | `fs/promises` | 文件末尾追加内容，文件不存在则创建 |
| `access(path)` | `fs/promises` | 检查文件可访问性，不存在则抛错 |
| `join(...segments)` | `path` | 跨平台路径拼接 |
| `dirname(p)` | `path` | 取父目录路径 |
| `fileURLToPath(url)` | `url` | 将 `file://` URL 转为系统路径 |
| `import.meta.url` | ESM 元信息 | 当前模块的文件 URL |
| `process.stdin` | `process` | 标准输入可读流 |
| `process.stdout` | `process` | 标准输出可写流 |
| `process.exit(code)` | `process` | 以指定退出码结束进程 |

---

## 6. 正则表达式速查

| 字符 | 含义 | 示例 |
|------|------|------|
| `^` | 字符串开头 | `^a` → 以 a 开头 |
| `$` | 字符串结尾 | `a$` → 以 a 结尾 |
| `+` | 一到多个 | `\d+` → 至少一个数字 |
| `*` | 零到多个 | `\s*` → 零或多个空格 |
| `\d` | 数字 `[0-9]` | `\d{3}` → 三位数字 |
| `\s` | 空白符（空格、tab、换行） | `\s+` → 一个以上空白 |
| `[abc]` | 字符类：a、b 或 c | `[a-z]` → 小写字母 |
| `[^abc]` | 否定字符类：非 a、b、c | `[^\s@]` → 非空白且非 @ |
| `\.` | 字面句点 | `\.com` → ".com" |
| `\-` | 字面连字符 | `[+\-]` → + 或 - |
| `.test(str)` | RegExp 方法 | `/^\d+$/.test("123")` → `true` |

---

## 7. 关键设计模式

### 7.1 EAFP（先试再兜底）

```ts
// ✅ EAFP
try { await access(path); } catch { /* 创建 */ }

// ❌ LBYL（存在竞态条件）
if (fileExists(path)) { /* 不是原子的！ */ }
```

### 7.2 数据驱动

```ts
// ✅ 数据驱动：新增字段只需加一条配置
const FIELDS = [
  { key: "name", prompt: "Name: ", validate: validateName },
  { key: "phone", prompt: "Phone: ", validate: validatePhone },
  { key: "email", prompt: "Email: ", validate: validateEmail },
];

// ❌ 硬编码：N 个字段要写 N 份相似代码
const name = await askName();
const phone = await askPhone();
const email = await askEmail();
```

### 7.3 默认为 N（安全默认值）

```ts
// "y/N" → 大写 N 表示默认值
// 用户直接回车 → 退出，不会误操作
if (again !== "y") running = false;
```

### 7.4 资源清理（finally）

```ts
try {
  // 使用 readline
} finally {
  rl.close();  // 无论成功还是失败，都要释放资源
}
```

---

## 8. 常见问题

### Q: `"type": "module"` 和 CommonJS 有什么区别？

| | ESM | CommonJS |
|---|---|---|
| 导入 | `import` | `require()` |
| 导出 | `export` / `export default` | `module.exports` |
| 顶层 await | ✅ 支持 | ❌ 不支持 |
| `__dirname` | ❌ 无（需手动构造） | ✅ 有 |
| 加载时机 | 静态分析，编译时确定 | 动态加载，运行时执行 |

### Q: 为什么不用 `fs.existsSync()` 检查文件？

`existsSync` 是唯一被允许的 sync 方法，但 `access()` 更符合要求（异步非阻塞）。`existsSync` 返回 boolean，`access()` 抛异常——后者更符合 Node.js 的 EAFP 惯例。

### Q: `rl.close()` 不调用会怎样？

进程不会退出，一直挂起。`readline` 持有 `stdin` 的引用，Node.js 事件循环认为还有未完成的工作。

### Q: `as Contact` 类型断言安全吗？

在第 141 行 `await appendContact(contact as Contact)` 中——`promptField` 已经确保三个字段都被赋值，所以断言是安全的。更好的做法是直接构造完整对象（当前代码已采用）。

---

> **对应文件**: `ch02-cli-data-converter/index.ts`
> **测试脚本**: `ch02-cli-data-converter/test.mjs`
> **作业要求**: `specs/2.md`
