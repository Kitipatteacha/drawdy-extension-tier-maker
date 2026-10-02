import { TableConfig, DEFAULTS } from "./config";

export const META_KEY = "drawdyTier";

export const STRUCTURE_LAYER = 0;
export const ITEM_LAYER = 1;

export type PartKind = "title" | "label" | "body" | "item";

export type TableScalars = Pick<
  TableConfig,
  "width" | "labelWidth" | "rowHeight" | "itemHeight"
>;

export type TierMeta = {
  v: 1;
  tableId: string;
  part: PartKind;
  rowId: string;
  cfg?: TableScalars;
};

export const itemMeta = (tableId: string, rowId: string): TierMeta => ({
  v: 1,
  tableId,
  part: "item",
  rowId,
});

export function readMeta(meta: unknown): TierMeta | null {
  if (typeof meta !== "object" || meta === null) return null;
  const stored = (meta as Record<string, unknown>)[META_KEY];
  if (typeof stored !== "object" || stored === null) return null;
  const m = stored as Partial<TierMeta>;
  if (typeof m.tableId !== "string" || m.tableId === "") return null;
  if (
    m.part !== "title" &&
    m.part !== "label" &&
    m.part !== "body" &&
    m.part !== "item"
  ) {
    return null;
  }
  return {
    v: 1,
    tableId: m.tableId,
    part: m.part,
    rowId: typeof m.rowId === "string" ? m.rowId : "",
    cfg: readScalars(m.cfg),
  };
}

export function readScalars(value: unknown): TableScalars | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const c = value as Partial<TableScalars>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  return {
    width: num(c.width, DEFAULTS.width),
    labelWidth: num(c.labelWidth, DEFAULTS.labelWidth),
    rowHeight: num(c.rowHeight, DEFAULTS.rowHeight),
    itemHeight: num(c.itemHeight, DEFAULTS.itemHeight),
  };
}
