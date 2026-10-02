import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

import { redrawTable } from "./redraw";
import { enqueue } from "../drawdy-bridge/queue";
import { knownSize, scanScene } from "../drawdy-bridge/scene";
import { near } from "../table/layout";
import { readMeta } from "../table/meta";

const dirty = new Set<string>();

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

    const was = knownSize(element.id);
    if (
      was &&
      near(was.width, element.width) &&
      near(was.height, element.height)
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
