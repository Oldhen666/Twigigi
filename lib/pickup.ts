const OPEN = 8 * 60;
const CLOSE = 20 * 60;
const LATE = 23 * 60 + 45;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const WEEKEND_NAMES = ["Saturday", "Sunday"] as const;
const DAY_NAMES = [...WEEKDAY_NAMES, ...WEEKEND_NAMES] as const;

type TimeMode = "" | "before" | "after" | "between";

export type PickupWindow = {
  days: string[];
  from: number;
  to: number;
};

export type CivilTime = {
  year: number;
  month: number;
  day: number;
  minutes: number;
};

export const PICKUP_ZONE = "America/Edmonton";
export const PICKUP_HORIZON_DAYS = 56;

export function pickupWindows(value: string): PickupWindow[] {
  const windows: PickupWindow[] = [];
  for (const part of value.split("|").map((item) => item.trim()).filter(Boolean).slice(0, 3)) {
    const slot = parseSlot(part);
    if (!slot) continue;
    const range = clockRange(slot.mode, slot.start, slot.end);
    if (!range || slot.days.length === 0) continue;
    windows.push({ days: slot.days, from: range.from, to: range.to });
  }
  return windows;
}

export function quarterHours(from: number, to: number) {
  if (to < from) return [];
  const start = Math.ceil(from / 15) * 15;
  const end = Math.floor(to / 15) * 15;
  const minutes: number[] = [];
  for (let minute = start; minute <= end; minute += 15) minutes.push(minute);
  return minutes;
}

export function minutesOnDay(schedules: string[], weekday: string) {
  if (schedules.length === 0) return [];
  const lists = schedules.map((schedule) => {
    const minutes = new Set<number>();
    for (const window of pickupWindows(schedule)) {
      if (!window.days.includes(weekday)) continue;
      for (const minute of quarterHours(window.from, window.to)) minutes.add(minute);
    }
    return [...minutes];
  });
  return lists.reduce((shared, list) => shared.filter((minute) => list.includes(minute))).sort((a, b) => a - b);
}

export function openMinutes(schedules: string[], year: number, month: number, day: number, now: CivilTime) {
  const key = civilKey({ year, month, day });
  const today = civilKey(now);
  const last = civilKey(addCivilDays(now, PICKUP_HORIZON_DAYS));
  if (key < today || key > last) return [];
  const minutes = minutesOnDay(schedules, weekdayName(year, month, day));
  if (key !== today) return minutes;
  return minutes.filter((minute) => minute > now.minutes);
}

export function pickupChoiceProblem(schedules: string[], choice: string, now = new Date()) {
  if (schedules.length === 0 || schedules.some((schedule) => pickupWindows(schedule).length === 0)) {
    return "The seller has not set pickup days.";
  }
  const parsed = parsePickupChoice(choice);
  if (!parsed) return "Choose a pickup time.";
  const allowed = openMinutes(schedules, parsed.year, parsed.month, parsed.day, edmontonNow(now));
  if (!allowed.includes(parsed.minutes)) return "Choose a time the seller offered.";
  return null;
}

export function parsePickupChoice(value: string): CivilTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || minute % 15 !== 0) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day, minutes: hour * 60 + minute };
}

export function formatPickupChoice(value: string) {
  const parsed = parsePickupChoice(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${label}, ${formatClockMinutes(parsed.minutes)}`;
}

export function formatClockMinutes(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

export function choiceStamp(year: number, month: number, day: number, minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hour}:${minute}`;
}

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function weekdayName(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function edmontonNow(now = new Date()): CivilTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PICKUP_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    minutes: Number(bag.hour) * 60 + Number(bag.minute),
  };
}

export function addCivilDays(civil: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: ({ year: number; month: number; day: number } | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push({ year, month, day });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function civilKey(civil: { year: number; month: number; day: number }) {
  return civil.year * 10000 + civil.month * 100 + civil.day;
}

function clockRange(mode: TimeMode, start: string, end: string) {
  if (!mode) return { from: OPEN, to: CLOSE };
  const startMin = clockMinutes(start);
  const endMin = clockMinutes(end);
  if (mode === "before") {
    if (startMin == null) return null;
    return { from: startMin > OPEN ? OPEN : Math.max(0, startMin - 4 * 60), to: startMin };
  }
  if (mode === "after") {
    if (startMin == null) return null;
    return { from: startMin, to: startMin < CLOSE ? CLOSE : Math.min(LATE, startMin + 3 * 60) };
  }
  if (startMin == null || endMin == null || endMin < startMin) return null;
  return { from: startMin, to: endMin };
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseSlot(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let rest = trimmed;
  let mode: TimeMode = "";
  let start = "";
  let end = "";
  const between = rest.match(/,\s*between\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+and\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const before = rest.match(/,\s*before\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const after = rest.match(/,\s*after\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const range = rest.match(/,\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*(AM|PM)?\s*$/i);
  const hit = between ?? before ?? after ?? range;
  if (between) {
    mode = "between";
    start = to24(between[1]);
    end = to24(between[2]);
  } else if (before) {
    mode = "before";
    start = to24(before[1]);
  } else if (after) {
    mode = "after";
    start = to24(after[1]);
  } else if (range) {
    mode = "between";
    const suffix = range[3] ?? "";
    start = to24(`${range[1]} ${suffix}`.trim());
    end = to24(`${range[2]} ${suffix}`.trim());
  }
  if (hit?.index != null) rest = rest.slice(0, hit.index).trim();
  const days = expandDays(rest);
  if (!days || days.length === 0) return null;
  if ((mode === "before" || mode === "after") && !start) return null;
  if (mode === "between" && (!start || !end)) return null;
  return { days, mode, start, end };
}

function expandDays(value: string) {
  if (!value) return null;
  const known = new Map<string, readonly string[]>([
    ["every day", DAY_NAMES],
    ["weekdays", WEEKDAY_NAMES],
    ["weekends", WEEKEND_NAMES],
    ...DAY_NAMES.map((day) => [day.toLowerCase(), [day]] as const),
  ]);
  const selected = new Set<string>();
  for (const token of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const days = known.get(token.toLowerCase());
    if (!days) return null;
    days.forEach((day) => selected.add(day));
  }
  return DAY_NAMES.filter((day) => selected.has(day));
}

function to24(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return "";
  let hour = Number(match[1]);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  if (hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
