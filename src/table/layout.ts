import { TableConfig, DEFAULTS, POOL_ROW_ID } from "./config";

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

export type ItemSize = { id: string; width: number; height: number };

export type PlacedItem = ItemSize & Point;

export type LaidRow = {
  rowId: string;
  label: string;
  color: string | null;
  labelRect: Rect;
  bodyRect: Rect;
  bandRect: Rect;
  items: PlacedItem[];
};

export type LaidTable = {
  rect: Rect;
  titleRect: Rect | null;
  rows: LaidRow[];
};

function rowsOf(
  config: TableConfig,
): { id: string; label: string; color: string | null }[] {
  const rows = config.rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color as string | null,
  }));
  rows.push({ id: POOL_ROW_ID, label: "Pool", color: null });
  return rows;
}

const gapOf = (config: TableConfig): number =>
  Math.max(2, Math.round(config.itemHeight * 0.08));

const poolGapOf = (config: TableConfig): number => gapOf(config) * 4;

export function wrapLines(
  items: ItemSize[],
  available: number,
  gap: number,
): ItemSize[][] {
  const lines: ItemSize[][] = [];
  let line: ItemSize[] = [];
  let used = 0;
  for (const item of items) {
    if (line.length > 0 && used + gap + item.width > available) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length > 0 ? gap : 0) + item.width;
    line.push(item);
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

export function layoutTable(
  config: TableConfig,
  origin: Point,
  itemsByRow: Map<string, ItemSize[]>,
): LaidTable {
  const gap = gapOf(config);
  const labelWidth = Math.min(config.labelWidth, config.width - 40);
  const bodyWidth = config.width - labelWidth;
  const available = bodyWidth - gap * 2;

  const titled = config.title.trim() !== "";
  const titleHeight = titled ? DEFAULTS.titleHeight : 0;
  const titleRect = titled
    ? { x: origin.x, y: origin.y, width: config.width, height: titleHeight }
    : null;

  const rows: LaidRow[] = [];
  let y = origin.y + titleHeight;

  for (const row of rowsOf(config)) {
    if (row.id === POOL_ROW_ID) y += poolGapOf(config);

    const items = itemsByRow.get(row.id) ?? [];
    const lines = wrapLines(items, available, gap);

    const lineHeights = lines.map((line) =>
      line.reduce((tallest, item) => Math.max(tallest, item.height), 0),
    );
    const content =
      lineHeights.reduce((sum, h) => sum + h, 0) +
      Math.max(0, lines.length - 1) * gap;
    const height = Math.max(config.rowHeight, content + gap * 2);

    const placed: PlacedItem[] = [];
    let lineTop = y + gap;
    lines.forEach((line, i) => {
      let x = origin.x + labelWidth + gap;
      for (const item of line) {
        placed.push({
          ...item,
          x,
          y: lineTop + (lineHeights[i] - item.height) / 2,
          width: item.width,
          height: item.height,
        });
        x += item.width + gap;
      }
      lineTop += lineHeights[i] + gap;
    });

    rows.push({
      rowId: row.id,
      label: row.label,
      color: row.color,
      labelRect: { x: origin.x, y, width: labelWidth, height },
      bodyRect: { x: origin.x + labelWidth, y, width: bodyWidth, height },
      bandRect: { x: origin.x, y, width: config.width, height },
      items: placed,
    });

    y += height;
  }

  return {
    rect: {
      x: origin.x,
      y: origin.y,
      width: config.width,
      height: y - origin.y,
    },
    titleRect,
    rows,
  };
}

export const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height;

export function flowSort<T extends PlacedItem>(items: T[]): T[] {
  const byCentre = [...items].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2) || a.x - b.x,
  );

  const lines: { top: number; bottom: number; items: T[] }[] = [];
  for (const item of byCentre) {
    const centre = item.y + item.height / 2;
    const line = lines[lines.length - 1];
    if (line && centre > line.top && centre < line.bottom) {
      line.items.push(item);
      line.top = Math.min(line.top, item.y);
      line.bottom = Math.max(line.bottom, item.y + item.height);
    } else {
      lines.push({
        top: item.y,
        bottom: item.y + item.height,
        items: [item],
      });
    }
  }

  return lines.flatMap((line) => line.items.sort((a, b) => a.x - b.x));
}

export function insertionIndex(
  ordered: PlacedItem[],
  dropped: PlacedItem,
): number {
  const index = flowSort([...ordered, dropped]).findIndex(
    (item) => item.id === dropped.id,
  );
  return index < 0 ? ordered.length : index;
}

export const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.5;

export const moved = (dx: number, dy: number): boolean =>
  Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
