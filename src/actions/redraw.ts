import { DrawdyElementSchema } from "@drawdy/driver-protocol";

import { SceneTable } from "../table/collect";
import { TableConfig } from "../table/config";
import { buildTableElements, imageElement } from "../table/draw";
import {
  layoutTable,
  moved,
  near,
  PlacedItem,
  Rect,
} from "../table/layout";
import {
  commitEdit,
  Placement,
  SceneEdit,
  Tag,
} from "../drawdy-bridge/scene";

type Changes = {
  config?: TableConfig;
  pending?: Map<string, { blob: Blob }>;
};

export type Redrawn = { partIds: string[]; edit: SceneEdit };

const sameRect = (a: Rect, b: Rect): boolean =>
  near(a.x, b.x) &&
  near(a.y, b.y) &&
  near(a.width, b.width) &&
  near(a.height, b.height);

/**
 * What redrawing the table would change, without touching the board. Parts
 * keep their id while only their geometry changes, so a row growing or
 * shifting is moved and resized in place; only a new row, or new text on
 * one, is drawn fresh.
 */
export function planTable(
  table: SceneTable,
  itemsByRow: Map<string, PlacedItem[]>,
  changes: Changes = {},
): Redrawn {
  const config = changes.config ?? table.config;
  const laid = layoutTable(config, table.origin, itemsByRow);

  // Where the board has each item now: the last scan when we have one, else
  // the geometry the caller handed in.
  const onBoard = new Map<string, PlacedItem>();
  for (const items of itemsByRow.values()) {
    for (const item of items) onBoard.set(item.id, item);
  }
  for (const items of table.items.values()) {
    for (const item of items) onBoard.set(item.id, item);
  }

  const add: DrawdyElementSchema[] = [];
  const placements: Placement[] = [];
  for (const row of laid.rows) {
    for (const item of row.items) {
      const source = changes.pending?.get(item.id);
      if (source) {
        add.push(imageElement(table.tableId, item, row.rowId, source.blob));
        continue;
      }
      const was = onBoard.get(item.id);
      if (was && moved(item.x - was.x, item.y - was.y)) {
        placements.push({ id: item.id, x: item.x, y: item.y });
      }
    }
  }

  const parts = buildTableElements(table.tableId, config, laid);
  for (const part of parts) {
    const at = table.partRects.get(part.drawdyElementId);
    if (!at) {
      add.push(part);
      continue;
    }
    // The title's id holds its geometry, so finding it means it fits.
    if (part.type !== "shape") continue;
    const { x, y, width = at.width, height = at.height } = part;
    if (!sameRect(at, { x, y, width, height })) {
      placements.push({ id: part.drawdyElementId, x, y, width, height });
    }
  }

  // Anything else is a part this layout no longer has: a deleted row, old
  // text, or a row drawn twice by two drivers at once.
  const partIds = parts.map((part) => part.drawdyElementId);
  const keep = new Set(partIds);
  return {
    partIds,
    edit: {
      add,
      tags: [],
      placements,
      remove: table.partIds.filter((id) => !keep.has(id)),
    },
  };
}

/** Redraws the table, along with any retags, as one action. */
export async function redrawTable(
  table: SceneTable,
  itemsByRow: Map<string, PlacedItem[]>,
  changes: Changes = {},
  tags: Tag[] = [],
): Promise<Redrawn | null> {
  const plan = planTable(table, itemsByRow, changes);
  return (await commitEdit({ ...plan.edit, tags })) ? plan : null;
}
