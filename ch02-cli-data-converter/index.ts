// 第二章 CLI 数据转换器 — 联系人信息写入 CSV
// Node.js v22+ | ESM + TypeScript | 零外部依赖（仅 dev）

import * as readline from "node:readline/promises";
import { appendFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ──────────────────────────────────────────────
//  类型定义
// ──────────────────────────────────────────────

interface Contact {
  name: string;
  phone: string;
  email: string;
}

/** 校验函数：返回错误信息字符串，通过则返回 null */
type Validator = (input: string) => string | null;

interface FieldConfig {
  key: keyof Contact;
  prompt: string;
  validate: Validator;
}

// ──────────────────────────────────────────────
//  配置
// ──────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "contacts.csv");
const HEADER = "NAME,PHONE,EMAIL";

const FIELDS: FieldConfig[] = [
  { key: "name",  prompt: "Name: ",  validate: validateName },
  { key: "phone", prompt: "Phone: ", validate: validatePhone },
  { key: "email", prompt: "Email: ", validate: validateEmail },
];

// ──────────────────────────────────────────────
//  校验函数 — 返回错误字符串，通过则返回 null
// ──────────────────────────────────────────────

function validateName(input: string): string | null {
  if (!input.trim()) return "姓名不能为空。";
  return null;
}

function validatePhone(input: string): string | null {
  // 国际化宽松模式：允许数字、空格、+、-，至少包含一个数字
  if (!/^[+\-\s]*\d[+\-\d\s]*$/.test(input.trim())) {
    return "电话号码只能包含数字、空格、+、-，且至少需要一个数字。";
  }
  return null;
}

function validateEmail(input: string): string | null {
  // 基础 xxx@yyy.zzz 格式
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())) {
    return "邮箱格式必须为 xxx@yyy.zzz。";
  }
  return null;
}

// ──────────────────────────────────────────────
//  CSV 工具函数
// ──────────────────────────────────────────────

/**
 * CSV 值转义：若包含逗号或双引号，则用双引号包裹，
 * 内部双引号加倍处理。
 */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 确保 CSV 文件存在且包含表头行。
 * 使用 access() 检测文件；若不存在则创建并写入表头。
 */
async function ensureCsv(): Promise<void> {
  try {
    await access(CSV_PATH);
  } catch {
    // 文件不存在 → 创建并写入表头
    await appendFile(CSV_PATH, `${HEADER}\n`, "utf-8");
    console.log("（已创建 contacts.csv 并写入表头）");
  }
}

/**
 * 向 CSV 追加一条联系人记录。
 */
async function appendContact(contact: Contact): Promise<void> {
  const row = [contact.name, contact.phone, contact.email]
    .map(csvEscape)
    .join(",");
  await appendFile(CSV_PATH, `${row}\n`, "utf-8");
}

// ──────────────────────────────────────────────
//  逐字段询问（校验失败时重新询问当前字段）
// ──────────────────────────────────────────────

async function promptField(
  rl: readline.Interface,
  config: FieldConfig,
): Promise<string> {
  while (true) {
    const answer = (await rl.question(config.prompt)).trim();
    const error = config.validate(answer);
    if (error) {
      console.log(`❌ ${error}`);
    } else {
      return answer;
    }
  }
}

// ──────────────────────────────────────────────
//  主交互循环
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("📇  命令行联系人管理器");
  console.log("请输入联系人信息。 按 Ctrl+C 可随时退出。\n");

  try {
    // 首次运行前确保 CSV 文件就绪
    await ensureCsv();

    let running = true;
    while (running) {
      // ── 逐字段收集（校验失败会原地重试）──
      const contact: Contact = {
        name:  await promptField(rl, FIELDS[0]),
        phone: await promptField(rl, FIELDS[1]),
        email: await promptField(rl, FIELDS[2]),
      };

      // ── 保存 ──
      await appendContact(contact);
      console.log("✅ 联系人已保存！\n");

      // ── 是否继续？ ──
      const again = (await rl.question("是否继续？(y/N): ")).trim().toLowerCase();
      if (again !== "y") {
        running = false;
      }
      console.log(); // 空行提升可读性
    }

    console.log("👋 再见！");
  } catch (err) {
    // readline 在 stdin 关闭时（如管道输入耗尽、用户按 Ctrl+C）会抛出异常
    // 捕获这些情况并静默退出
    if (err instanceof Error) {
      const errnoCode = "code" in err ? (err as Error & { code: string }).code : undefined;
      if (
        errnoCode === "ABORT_ERR" ||
        err.name === "AbortError" ||
        err.message.includes("readline was closed")
      ) {
        return; // 静默退出：管道关闭/用户中断属正常行为
      }
    }
    throw err;
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("致命错误：", err instanceof Error ? err.message : err);
  process.exit(1);
});
