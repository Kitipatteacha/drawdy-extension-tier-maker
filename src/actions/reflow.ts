import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

import { redrawTable } from "./redraw";
import { enqueue } from "../drawdy-bridge/queue";
import { knownSize, scanScene } from "../drawdy-bridge/scene";
import { near } from "../table/layout";
import { readMeta } from "../table/meta";

const dirty = new Set<string>();

let selected = new Set<string>();

export function noteSelection(ids: readonly string[]): void {
  selected = new Set(ids);
}

const SETTLE_MS = 500;
let settle: ReturnType<typeof setTimeout> | null = null;

export function noteUpdated(
  elements: readonly SubscribedDrawdyElement[],
): void {
  let resized = false;
  for (const element of elements) {
    const meta = readMeta(element.meta);
    if (meta?.part !== "item") continue;
    if (typeof element.width !== "number") continue;
    if (typeof element.height !== "number") continue;

    // Every collaborator's driver hears every update. Only the one whose user
    // has the item selected, the one holding its resize handles, reflows it,
    // so a resize redraws the table once rather than once per person.
    if (!selected.has(element.id)) continue;

    // An item this driver never measured is news, not a resize.
    const was = knownSize(element.id);
    if (
      !was ||
      (near(was.width, element.width) && near(was.height, element.height))
    ) {
      continue;
    }
    dirty.add(meta.tableId);
    resized = true;
  }
  if (!resized) return;

  if (settle !== null) clearTimeout(settle);
  settle = setTimeout(() => {
    settle = null;
    enqueue(reflowResized);
  }, SETTLE_MS);
}

export async function reflowResized(): Promise<void> {
  if (settle !== null) {
    clearTimeout(settle);
    settle = null;
  }
  if (dirty.size === 0) return;
  const tableIds = [...dirty];
  dirty.clear();

  const scene = await scanScene();
  if (!scene) return;
  for (const tableId of tableIds) {
    const table = scene.tables.get(tableId);
    if (table) await redrawTable(table, table.items);
  }
}
