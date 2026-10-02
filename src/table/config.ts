import { TIER_COLORS } from "./palette";

export type TierRow = {
  id: string;
  label: string;
  color: string;
};

export type TableConfig = {
  title: string;
  rows: TierRow[];
  width: number;
  labelWidth: number;
  rowHeight: number;
  itemHeight: number;
};

export const POOL_ROW_ID = "pool";

export const MAX_ROWS = 12;
export const MAX_LABEL_LENGTH = 24;
const MAX_TITLE_LENGTH = 80;

export const DEFAULTS = {
  width: 1040,
  labelWidth: 170,
  rowHeight: 96,
  gap: 6,
  itemHeight: 84,
  titleHeight: 54,
  titleFontSize: 30,
  labelFontSize: 22,
} as const;

const LIMITS = {
  width: [420, 3200],
  labelWidth: [70, 480],
  rowHeight: [48, 320],
  itemHeight: [32, 300],
} as const satisfies Record<string, readonly [number, number]>;

const DEFAULT_TIERS = ["S", "A", "B", "C", "D", "F"];

const clamp = (value: number, [lo, hi]: readonly [number, number]): number =>
  Math.min(hi, Math.max(lo, Math.round(value)));

let rowSeq = 0;
export const newRowId = (): string =>
  `r${Date.now().toString(36)}${(rowSeq++).toString(36)}`;

export function defaultConfig(): TableConfig {
  return {
    title: "Tier List",
    rows: DEFAULT_TIERS.map((label, i) => ({
      id: newRowId(),
      label,
      color: TIER_COLORS[i % TIER_COLORS.length],
    })),
    width: DEFAULTS.width,
    labelWidth: DEFAULTS.labelWidth,
    rowHeight: DEFAULTS.rowHeight,
    itemHeight: DEFAULTS.itemHeight,
  };
}

const COLOR = /^#[0-9a-fA-F]{3,8}$/;

export function sanitizeConfig(value: unknown): TableConfig {
  const base = defaultConfig();
  if (typeof value !== "object" || value === null) return base;
  const c = value as Partial<TableConfig>;

  const rows: TierRow[] = Array.isArray(c.rows)
    ? c.rows
        .filter(
          (row): row is TierRow => typeof row === "object" && row !== null,
        )
        .slice(0, MAX_ROWS)
        .map((row, i) => ({
          id:
            typeof row.id === "string" &&
            row.id !== "" &&
            row.id !== POOL_ROW_ID
              ? row.id
              : newRowId(),
          label:
            typeof row.label === "string"
              ? row.label.slice(0, MAX_LABEL_LENGTH)
              : String(i + 1),
          color:
            typeof row.color === "string" && COLOR.test(row.color)
              ? row.color
              : base.rows[i % base.rows.length].color,
        }))
    : base.rows;

  return {
    title:
      typeof c.title === "string"
        ? c.title.slice(0, MAX_TITLE_LENGTH)
        : base.title,
    rows: rows.length > 0 ? dedupeIds(rows) : base.rows,
    width: clamp(numberOr(c.width, base.width), LIMITS.width),
    labelWidth: clamp(
      numberOr(c.labelWidth, base.labelWidth),
      LIMITS.labelWidth,
    ),
    rowHeight: clamp(numberOr(c.rowHeight, base.rowHeight), LIMITS.rowHeight),
    itemHeight: clamp(
      numberOr(c.itemHeight, base.itemHeight),
      LIMITS.itemHeight,
    ),
  };
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function dedupeIds(rows: TierRow[]): TierRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (seen.has(row.id)) return { ...row, id: newRowId() };
    seen.add(row.id);
    return row;
  });
}
