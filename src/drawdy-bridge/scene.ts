import {
  DrawdyElementSchema,
  SubscribedDrawdyElement,
  UpdateableProperties,
} from "@drawdy/driver-protocol";

import {
  TABLE_PROPERTIES,
  collectTables,
  placedOf,
  SceneTable,
} from "../table/collect";
import { contains, PlacedItem, Point } from "../table/layout";
import { ITEM_LAYER, itemMeta, META_KEY, readMeta } from "../table/meta";
import { cameraPose, restoreCamera } from "./camera";
import { command } from "./session";

export type Scene = {
  elements: readonly SubscribedDrawdyElement[];
  tables: Map<string, SceneTable>;
  geo: Map<string, PlacedItem>;
};

/** An absolute spot, and a size for parts that are resized in place. */
export type Placement = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

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

async function existingIds(ids: string[]): Promise<Set<string>> {
  const res = await command("command:scene:get-drawdy-elements", {
    drawdyElementIds: ids,
    properties: ["type"],
  });
  return new Set((res?.drawdyElements ?? []).map((element) => element.id));
}

/**
 * Adds the elements the board doesn't have yet. Part ids come from their
 * content, so one that is already there is this exact element, left by an
 * earlier run or by a collaborator's driver drawing the same table. A lost
 * race with that driver is retried once against what it added.
 */
export async function addMissing(
  elements: DrawdyElementSchema[],
): Promise<boolean> {
  if (elements.length === 0) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const have = await existingIds(
      elements.map((element) => element.drawdyElementId),
    );
    const missing = elements.filter(
      (element) => !have.has(element.drawdyElementId),
    );
    if (missing.length === 0) return true;
    if (await addElements(missing)) return true;
  }
  return false;
}

async function removeElements(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await command("command:scene:remove-drawdy-elements", {
    drawdyElementIds: ids,
  });
}

const tagProperties = (tag: Tag): UpdateableProperties => ({
  meta: {
    [META_KEY]: tag.rowId === null ? null : itemMeta(tag.tableId, tag.rowId),
  },
  ...(tag.rowId === null ? {} : { layer: ITEM_LAYER }),
});

/**
 * Retags, places and resizes elements in one update. Placements are absolute, so
 * replaying them, or a collaborator's driver landing the same layout,
 * changes nothing.
 */
async function updateElements(
  tags: Tag[],
  placements: Placement[],
): Promise<void> {
  const updates = new Map<string, UpdateableProperties>();
  for (const tag of tags) updates.set(tag.id, tagProperties(tag));
  for (const { id, x, y, width, height } of placements) {
    updates.set(id, {
      ...updates.get(id),
      transform: { x, y },
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
    });
  }
  if (updates.size === 0) return;
  await command("command:scene:update-drawdy-elements", {
    updates: [...updates].map(([drawdyElementId, properties]) => ({
      drawdyElementId,
      properties,
    })),
  });
}

export type SceneEdit = {
  add: DrawdyElementSchema[];
  tags: Tag[];
  placements: Placement[];
  remove: string[];
};

export const emptyEdit = (): SceneEdit => ({
  add: [],
  tags: [],
  placements: [],
  remove: [],
});

export const mergeEdits = (edits: SceneEdit[]): SceneEdit => ({
  add: edits.flatMap((edit) => edit.add),
  tags: edits.flatMap((edit) => edit.tags),
  placements: edits.flatMap((edit) => edit.placements),
  remove: edits.flatMap((edit) => edit.remove),
});

/**
 * Lands one user action on the board. Drawdy closes an undo step before
 * every scene command, so the action is sent as at most one add, one update
 * and one removal. Moving, resizing and retagging all ride the update, so an
 * action that draws nothing new and deletes nothing is a single undo step.
 */
export async function commitEdit(edit: SceneEdit): Promise<boolean> {
  if (edit.add.length > 0 && !(await addMissing(edit.add))) return false;
  await updateElements(edit.tags, edit.placements);
  await removeElements(edit.remove);
  return true;
}

export async function selectElements(ids: string[]): Promise<void> {
  await command("command:scene:set-selection", { drawdyElementIds: ids });
}
