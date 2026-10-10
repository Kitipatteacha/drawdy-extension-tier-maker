import { planTable } from "../redraw";
import {
  bandAt,
  commitEdit,
  mergeEdits,
  Scene,
  scanScene,
  SceneEdit,
  Tag,
} from "../../drawdy-bridge/scene";
import { SceneTable } from "../../table/collect";
import { POOL_ROW_ID } from "../../table/config";
import { insertionIndex, PlacedItem } from "../../table/layout";
import { postCounts } from "../../panel/binding";
import type { DragMachine } from "./machine";
import { DragState } from "./state";

type Where = { tableId: string; rowId: string } | null;

type Landing = {
  id: string;
  geo: PlacedItem;
  was: Where;
  now: Where;
  redirected: boolean;
};

function filedUnder(scene: Scene, id: string): Where {
  for (const table of scene.tables.values()) {
    const rowId = table.rowOfItem.get(id);
    if (rowId !== undefined) return { tableId: table.tableId, rowId };
  }
  return null;
}

const sameRow = (a: Where, b: Where): boolean =>
  a?.tableId === b?.tableId && a?.rowId === b?.rowId;

function landingsOf(scene: Scene, ids: string[]): Landing[] {
  const structural = new Set(
    [...scene.tables.values()].flatMap((table) => table.partIds),
  );
  const images = new Set(
    scene.elements.filter((el) => el.type === "image").map((el) => el.id),
  );
  const landings: Landing[] = [];
  for (const id of ids) {
    if (structural.has(id)) continue;
    const geo = scene.geo.get(id);
    if (!geo) continue;
    const was = filedUnder(scene, id);
    const hit = images.has(id)
      ? bandAt(scene.tables, geo.x + geo.width / 2, geo.y + geo.height / 2)
      : null;

    const redirected =
      was === null && hit !== null && hit.rowId !== POOL_ROW_ID;
    const now = redirected ? { tableId: hit.tableId, rowId: POOL_ROW_ID } : hit;
    if (was !== null || now !== null)
      landings.push({ id, geo, was, now, redirected });
  }
  return landings;
}

const retagsFor = (landings: Landing[]): Tag[] =>
  landings
    .filter((landing) => !sameRow(landing.was, landing.now))
    .map((landing) => ({
      id: landing.id,
      tableId: landing.now?.tableId ?? landing.was?.tableId ?? "",
      rowId: landing.now?.rowId ?? null,
    }));

type Refiled = { tableId: string; itemsByRow: Map<string, PlacedItem[]> };

function refile(table: SceneTable, landings: Landing[]): Refiled {
  const lifted = new Set(landings.map((landing) => landing.id));
  const itemsByRow = new Map<string, PlacedItem[]>();
  for (const [rowId, items] of table.items) {
    itemsByRow.set(
      rowId,
      items.filter((item) => !lifted.has(item.id)),
    );
  }
  for (const { now, geo, redirected } of landings) {
    if (now?.tableId !== table.tableId) continue;
    const list = itemsByRow.get(now.rowId) ?? [];

    list.splice(redirected ? list.length : insertionIndex(list, geo), 0, geo);
    itemsByRow.set(now.rowId, list);
  }
  return { tableId: table.tableId, itemsByRow };
}

export class MovingItems extends DragState {
  public constructor(
    machine: DragMachine,
    private readonly ids: string[],
  ) {
    super(machine);
  }

  public override async onDragEnd(): Promise<void> {
    const scene = await scanScene();
    if (!scene || scene.tables.size === 0) return;

    const landings = landingsOf(scene, this.ids);
    if (landings.length === 0) return;

    const touched = new Set<string>();
    for (const { was, now } of landings) {
      if (was) touched.add(was.tableId);
      if (now) touched.add(now.tableId);
    }

    // Every table the drop touched lands in the same commit, so ranking an
    // image across two lists is still one undo.
    const refiled: Refiled[] = [];
    const edits: SceneEdit[] = [];
    for (const tableId of touched) {
      const table = scene.tables.get(tableId);
      if (!table) continue;
      const next = refile(table, landings);
      refiled.push(next);
      edits.push(planTable(table, next.itemsByRow).edit);
    }
    const edit = { ...mergeEdits(edits), tags: retagsFor(landings) };
    if (!(await commitEdit(edit))) return;
    for (const { tableId, itemsByRow } of refiled) {
      postCounts(tableId, itemsByRow);
    }
  }
}
