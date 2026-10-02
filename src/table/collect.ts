import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

import { TableConfig, DEFAULTS, POOL_ROW_ID } from "./config";
import { flowSort, PlacedItem, Point, Rect } from "./layout";
import { TableScalars, readMeta, readScalars } from "./meta";
import { TIER_COLORS } from "./palette";

export type SceneTable = {
  tableId: string;
  config: TableConfig;
  origin: Point;
  partIds: string[];
  items: Map<string, PlacedItem[]>;
  rowOfItem: Map<string, string>;
  bands: { rowId: string; rect: Rect }[];
};

export const elementIdsOf = (table: SceneTable): string[] => [
  ...table.partIds,
  ...table.rowOfItem.keys(),
];

export const placedOf = (el: SubscribedDrawdyElement): PlacedItem | null =>
  typeof el.x === "number" &&
  typeof el.y === "number" &&
  typeof el.width === "number" &&
  typeof el.height === "number"
    ? { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }
    : null;

export const TABLE_PROPERTIES = [
  "meta",
  "type",
  "x",
  "y",
  "width",
  "height",
  "text",
  "fillColor",
] as const;

export function collectTables(
  elements: readonly SubscribedDrawdyElement[],
): Map<string, SceneTable> {
  type Draft = {
    title: SubscribedDrawdyElement | null;
    labels: (SubscribedDrawdyElement & { rowId: string })[];
    partIds: string[];
    cfg: TableScalars | null;
    items: { rowId: string; geo: PlacedItem }[];
  };

  const drafts = new Map<string, Draft>();

  for (const element of elements) {
    const meta = readMeta(element.meta);
    if (!meta) continue;
    let draft = drafts.get(meta.tableId);
    if (!draft) {
      draft = { title: null, labels: [], partIds: [], cfg: null, items: [] };
      drafts.set(meta.tableId, draft);
    }
    if (meta.part === "item") {
      const geo = placedOf(element);
      if (geo) draft.items.push({ rowId: meta.rowId, geo });
      continue;
    }
    draft.partIds.push(element.id);
    if (meta.cfg && !draft.cfg) draft.cfg = meta.cfg;
    if (meta.part === "title") draft.title = element;
    if (meta.part === "label") {
      draft.labels.push(Object.assign({ rowId: meta.rowId }, element));
    }
  }

  const tables = new Map<string, SceneTable>();

  for (const [tableId, draft] of drafts) {
    const labels = draft.labels
      .filter((label) => typeof label.y === "number")
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    if (labels.length === 0) continue;

    const cfg = draft.cfg ?? readScalars({})!;
    const title = typeof draft.title?.text === "string" ? draft.title.text : "";
    const tiers = labels.filter((label) => label.rowId !== POOL_ROW_ID);

    const config: TableConfig = {
      ...cfg,
      title,
      rows: tiers.map((label, i) => ({
        id: label.rowId,
        label: typeof label.text === "string" ? label.text : "",
        color: label.fillColor ?? TIER_COLORS[i % TIER_COLORS.length],
      })),
    };

    const first = labels[0];
    const origin = {
      x: first.x ?? 0,
      y: (first.y ?? 0) - (title.trim() === "" ? 0 : DEFAULTS.titleHeight),
    };

    const items = new Map<string, PlacedItem[]>();
    const rowOfItem = new Map<string, string>();
    for (const { rowId, geo } of draft.items) {
      rowOfItem.set(geo.id, rowId);
      const list = items.get(rowId);
      if (list) list.push(geo);
      else items.set(rowId, [geo]);
    }
    for (const [rowId, list] of items) items.set(rowId, flowSort(list));

    tables.set(tableId, {
      tableId,
      config,
      origin,
      partIds: draft.partIds,
      items,
      rowOfItem,
      bands: labels.map((label) => ({
        rowId: label.rowId,
        rect: {
          x: label.x ?? 0,
          y: label.y ?? 0,
          width: cfg.width,
          height: label.height ?? cfg.rowHeight,
        },
      })),
    });
  }

  return tables;
}
