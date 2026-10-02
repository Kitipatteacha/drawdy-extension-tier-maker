import { DrawdyElementSchema } from "@drawdy/driver-protocol";

import { SceneTable } from "../table/collect";
import { TableConfig } from "../table/config";
import { buildTableElements, imageElement } from "../table/draw";
import { LaidTable, layoutTable, near, PlacedItem, Point } from "../table/layout";
import {
  addElements,
  Move,
  moveElements,
  removeElements,
} from "../drawdy-bridge/scene";
import { newElementId } from "../drawdy-bridge/session";

function structureMatches(table: SceneTable, laid: LaidTable): boolean {
  if (table.bands.length !== laid.rows.length) return false;
  return laid.rows.every((row, i) => {
    const band = table.bands[i];
    return (
      band.rowId === row.rowId &&
      near(band.rect.x, row.bandRect.x) &&
      near(band.rect.y, row.bandRect.y) &&
      near(band.rect.height, row.bandRect.height) &&
      near(band.rect.width, row.bandRect.width)
    );
  });
}

type Redraw = {
  tableId: string;
  config: TableConfig;
  origin: Point;
  itemsByRow: Map<string, PlacedItem[]>;
  oldPartIds: string[];
  previous?: SceneTable;
  force?: boolean;
  pending?: Map<string, { blob: Blob }>;
};

export type Redrawn = { partIds: string[] };

async function redraw(r: Redraw): Promise<Redrawn | null> {
  const laid = layoutTable(r.config, r.origin, r.itemsByRow);

  // Where the board has each item now: the last scan when we have one, else
  // the geometry the caller handed in.
  const onBoard = new Map<string, PlacedItem>();
  for (const items of r.itemsByRow.values()) {
    for (const item of items) onBoard.set(item.id, item);
  }
  for (const items of r.previous?.items.values() ?? []) {
    for (const item of items) onBoard.set(item.id, item);
  }

  const created: DrawdyElementSchema[] = [];
  const moves: Move[] = [];
  for (const row of laid.rows) {
    for (const item of row.items) {
      const source = r.pending?.get(item.id);
      if (source) {
        created.push(imageElement(r.tableId, item, row.rowId, source.blob));
        continue;
      }
      const was = onBoard.get(item.id);
      if (was) moves.push({ id: item.id, dx: item.x - was.x, dy: item.y - was.y });
    }
  }

  const rebuilt =
    r.force === true ||
    r.previous === undefined ||
    !structureMatches(r.previous, laid);

  const parts = rebuilt
    ? buildTableElements(r.tableId, r.config, laid, newElementId)
    : [];
  const adding = [...parts, ...created];
  if (adding.length > 0 && !(await addElements(adding))) return null;
  if (rebuilt) await removeElements(r.oldPartIds);

  // update-drawdy-elements ignores geometry, so items move through a
  // committed preview, which also lands as one undo step.
  await moveElements(moves);
  return {
    partIds: rebuilt ? parts.map((part) => part.drawdyElementId) : r.oldPartIds,
  };
}

export function redrawTable(
  table: SceneTable,
  itemsByRow: Map<string, PlacedItem[]>,
  changes: Partial<Pick<Redraw, "config" | "force" | "pending">> = {},
): Promise<Redrawn | null> {
  return redraw({
    tableId: table.tableId,
    config: changes.config ?? table.config,
    origin: table.origin,
    itemsByRow,
    oldPartIds: table.partIds,
    previous: table,
    force: changes.force,
    pending: changes.pending,
  });
}
