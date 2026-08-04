// 营业时间模块 —— 数据 + 一个纯函数。
//
// 数据结构分三层，优先级从高到低：
//   1. dateOverrides  日期例外（节假日，键为 "MM-DD"）
//   2. dayOverrides   星期例外（键为星期名小写）
//   3. defaultHours   兜底默认营业时间
//
// 相比把例外与默认混在一个对象里，拆开两层例外更清晰：
// 遍历时不用再担心把 defaultHours 当成一个"星期"。

/** 一段营业时间：开门与打烊时刻（24 小时制字符串）。 */
export interface Hours {
  open: string;
  close: string;
}

/** 例外值：null 表示当天休息，Hours 表示当日特殊时间。 */
export type HoursOverride = Hours | null;

/** 默认营业时间（大多数日子的兜底值）。 */
export const defaultHours: Hours = { open: "11:00", close: "22:00" };

/**
 * 星期例外。
 * @type {Record<string, HoursOverride>}
 */
export const dayOverrides: Record<string, HoursOverride> = {
  monday: null, // 周一店休
  sunday: { open: "12:00", close: "21:00" }, // 周日缩短营业
};

/**
 * 日期例外（节假日）：键为 "MM-DD"（月份/日期补零到两位）。
 * @type {Record<string, HoursOverride>}
 */
export const dateOverrides: Record<string, HoursOverride> = {
  "12-25": null, // 圣诞节休息
  "01-01": null, // 元旦休息
};

/** 一周中某一天的展示元信息。 */
export interface DayEntry {
  key: string;
  name: string;
  /** JS 约定：0 = 周日，1 = 周一 … 6 = 周六。 */
  dayOfWeek: number;
}

/**
 * 一周七天的展示顺序（餐饮业通常以周一为一周的开始）。
 * 注意：JS 的 `Date.prototype.getDay()` 返回 **0 = 周日**、1 = 周一 … 6 = 周六，
 * 与中文习惯的"周一 = 0"相反，这里用 dayOfWeek 字段显式做映射。
 */
export const DAY_ORDER: DayEntry[] = [
  { key: "monday", name: "星期一", dayOfWeek: 1 },
  { key: "tuesday", name: "星期二", dayOfWeek: 2 },
  { key: "wednesday", name: "星期三", dayOfWeek: 3 },
  { key: "thursday", name: "星期四", dayOfWeek: 4 },
  { key: "friday", name: "星期五", dayOfWeek: 5 },
  { key: "saturday", name: "星期六", dayOfWeek: 6 },
  { key: "sunday", name: "星期日", dayOfWeek: 0 },
];

/** 一周中某一天计算后的营业状态，直接供模板渲染。 */
export interface DaySchedule {
  key: string;
  name: string;
  open: string | null;
  close: string | null;
  isClosed: boolean;
  isToday: boolean;
}

/** 把 1 → "01"，确保月份/日期都是两位，匹配 dateOverrides 的键格式。 */
const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * 计算某一周 7 天各自的营业状态，供 hours.ejs 直接渲染。
 *
 * @param now 基准日期（用于判断"今天"与日期例外），默认当前时间。
 * @returns 按 DAY_ORDER 顺序排列的 7 天营业状态。
 */
export function buildWeekSchedule(now: Date = new Date()): DaySchedule[] {
  const todayOfWeek = now.getDay();
  const monthDay = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return DAY_ORDER.map(({ key, name, dayOfWeek }) => {
    // 优先级：日期例外 → 星期例外 → 默认。
    // Object.hasOwn 比 `in` 更安全：只检查对象自身属性，不包含原型链，
    // 同时帮助 TS 把 override 收窄为 HoursOverride（无 undefined）。
    const override: HoursOverride = Object.hasOwn(dateOverrides, monthDay)
      ? dateOverrides[monthDay]
      : Object.hasOwn(dayOverrides, key)
        ? dayOverrides[key]
        : defaultHours;

    const isClosed = override === null;

    return {
      key,
      name,
      open: isClosed ? null : override.open,
      close: isClosed ? null : override.close,
      isClosed,
      isToday: dayOfWeek === todayOfWeek,
    };
  });
}
