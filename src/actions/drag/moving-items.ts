import { redrawTable } from "../redraw";
import {
  bandAt,
  Scene,
  scanScene,
  Tag,
  tagItems,
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
  const landings: Landing[] = [];
  for (const id of ids) {
    if (structural.has(id)) continue;
    const geo = scene.geo.get(id);
    if (!geo) continue;
    const was = filedUnder(scene, id);
    const hit = bandAt(
      scene.tables,
      geo.x + geo.width / 2,
      geo.y + geo.height / 2,
    );

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

async function refile(table: SceneTable, landings: Landing[]): Promise<void> {
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
  await redrawTable(table, itemsByRow);
  postCounts(table.tableId, itemsByRow);
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
    await tagItems(retagsFor(landings));

    const touched = new Set<string>();
    for (const { was, now } of landings) {
      if (was) touched.add(was.tableId);
      if (now) touched.add(now.tableId);
    }
    for (const tableId of touched) {
      const table = scene.tables.get(tableId);
      if (table) await refile(table, landings);
    }
  }
}
