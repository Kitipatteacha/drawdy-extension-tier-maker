import { DrawdyElementSchema } from "@drawdy/driver-protocol";

import { SceneTable } from "../table/collect";
import { TableConfig } from "../table/config";
import { buildTableElements, imageElement } from "../table/draw";
import {
  LaidTable,
  layoutTable,
  moved,
  near,
  PlacedItem,
  Point,
} from "../table/layout";
import {
  addElements,
  placeElements,
  Placement,
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

/**
 * The geometry change that takes an item from where the board has it to
 * where the layout wants it, or null when it is already there.
 */
function placementFor(item: PlacedItem, was: PlacedItem): Placement | null {
  const placement: Placement = { id: item.id };
  if (moved(item.x - was.x, item.y - was.y)) {
    placement.x = item.x;
    placement.y = item.y;
  }
  if (moved(item.width - was.width, item.height - was.height)) {
    placement.width = item.width;
    placement.height = item.height;
  }
  return placement.x === undefined && placement.width === undefined
    ? null
    : placement;
}

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
  const placements: Placement[] = [];
  for (const row of laid.rows) {
    for (const item of row.items) {
      const source = r.pending?.get(item.id);
      if (source) {
        created.push(imageElement(r.tableId, item, row.rowId, source.blob));
        continue;
      }
      const was = onBoard.get(item.id);
      if (!was) continue;
      const placement = placementFor(item, was);
      if (placement) placements.push(placement);
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

  // Every move and resize rides in one update, so it lands as one undo step.
  if (!(await placeElements(placements))) return null;
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
