import {
  DrawdyElementSchema,
  SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";

import {
  TABLE_PROPERTIES,
  collectTables,
  placedOf,
  SceneTable,
} from "../table/collect";
import { contains, moved, PlacedItem, Point } from "../table/layout";
import { ITEM_LAYER, itemMeta, META_KEY, readMeta } from "../table/meta";
import { cameraPose, restoreCamera } from "./camera";
import { command } from "./session";

export type Scene = {
  elements: readonly SubscribedDrawdyElement[];
  tables: Map<string, SceneTable>;
  geo: Map<string, PlacedItem>;
};

export type Move = { id: string; dx: number; dy: number };

export type Tag = { id: string; tableId: string; rowId: string | null };

const knownSizes = new Map<string, { width: number; height: number }>();

export const knownSize = (
  id: string,
): { width: number; height: number } | undefined => knownSizes.get(id);

export async function scanScene(): Promise<Scene | null> {
  const res = await command("command:scene:get-drawdy-elements", {
    properties: [...TABLE_PROPERTIES],
  });
  if (!res) return null;

  const geo = new Map<string, PlacedItem>();
  for (const element of res.drawdyElements) {
    const placed = placedOf(element);
    if (placed) geo.set(placed.id, placed);
  }
  const tables = collectTables(res.drawdyElements);

  knownSizes.clear();
  for (const table of tables.values()) {
    for (const id of table.rowOfItem.keys()) {
      const placed = geo.get(id);
      if (placed) {
        knownSizes.set(id, { width: placed.width, height: placed.height });
      }
    }
  }

  return { elements: res.drawdyElements, tables, geo };
}

export async function positionsOf(ids: string[]): Promise<Map<string, Point>> {
  const found = new Map<string, Point>();
  if (ids.length === 0) return found;
  const res = await command("command:scene:get-drawdy-elements", {
    drawdyElementIds: ids,
    properties: ["x", "y"],
  });
  for (const el of res?.drawdyElements ?? []) {
    if (typeof el.x === "number" && typeof el.y === "number") {
      found.set(el.id, { x: el.x, y: el.y });
    }
  }
  return found;
}

export async function touchesUs(ids: string[]): Promise<boolean> {
  const res = await command("command:scene:get-drawdy-elements", {
    drawdyElementIds: ids,
    properties: ["meta"],
  });
  return (res?.drawdyElements ?? []).some(
    (element) => readMeta(element.meta) !== null,
  );
}

export function targetTable(
  scene: Scene,
  tableId: string | null,
): SceneTable | null {
  if (tableId) return scene.tables.get(tableId) ?? null;
  if (scene.tables.size === 1) return [...scene.tables.values()][0];
  return null;
}

export function bandAt(
  tables: Map<string, SceneTable>,
  x: number,
  y: number,
): { tableId: string; rowId: string } | null {
  for (const table of tables.values()) {
    for (const band of table.bands) {
      if (contains(band.rect, x, y)) {
        return { tableId: table.tableId, rowId: band.rowId };
      }
    }
  }
  return null;
}

export async function addElements(
  elements: DrawdyElementSchema[],
): Promise<boolean> {
  if (elements.length === 0) return false;
  const before = await cameraPose();
  const added = await command("command:scene:add-drawdy-elements", {
    elements,
  });
  if (before) await restoreCamera(before);
  return added !== null;
}

export async function removeElements(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await command("command:scene:remove-drawdy-elements", {
    drawdyElementIds: ids,
  });
}

export async function moveElements(moves: Move[]): Promise<void> {
  const real = moves.filter((move) => moved(move.dx, move.dy));
  if (real.length === 0) return;

  const begun = await command("command:scene:begin-preview", {
    drawdyElementIds: real.map((move) => move.id),
  });
  if (!begun) return;

  const moving = new Set(begun.began);
  await command("command:scene:end-preview", {
    commits: real
      .filter((move) => moving.has(move.id))
      .map((move) => ({
        drawdyElementId: move.id,
        dx: move.dx,
        dy: move.dy,
        dRotation: 0,
      })),
  });
}

/** A new place and/or size for an element; fields left out stay as they are. */
export type Placement = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

/**
 * Applies every placement in one `update-drawdy-elements`, so however many
 * items move or resize, the board records a single undo step.
 */
export async function placeElements(placements: Placement[]): Promise<boolean> {
  if (placements.length === 0) return true;
  const res = await command("command:scene:update-drawdy-elements", {
    updates: placements.map(({ id, ...geometry }) => ({
      drawdyElementId: id,
      properties: geometry,
    })),
  });
  return res !== null;
}

export async function tagItems(tags: Tag[]): Promise<void> {
  if (tags.length === 0) return;
  await command("command:scene:update-drawdy-elements", {
    updates: tags.map((tag) => ({
      drawdyElementId: tag.id,
      properties: {
        meta: {
          [META_KEY]:
            tag.rowId === null ? null : itemMeta(tag.tableId, tag.rowId),
        },
        ...(tag.rowId === null ? {} : { layer: ITEM_LAYER }),
      },
    })),
  });
}

export async function selectElements(ids: string[]): Promise<void> {
  await command("command:scene:set-selection", { drawdyElementIds: ids });
}
