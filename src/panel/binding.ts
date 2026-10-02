import { ModuleStyling } from "@drawdy/driver-protocol";

import { elementIdsOf } from "../table/collect";
import { TableConfig, defaultConfig } from "../table/config";
import { PlacedItem } from "../table/layout";
import { scanScene, touchesUs } from "../drawdy-bridge/scene";
import { post } from "../drawdy-bridge/session";

let shownDesign: TableConfig = defaultConfig();
let boundTableId: string | null = null;

export const design = (): TableConfig => shownDesign;
export const showDesign = (config: TableConfig): void => {
  shownDesign = config;
};

export const boundTable = (): string | null => boundTableId;

const countsOf = (
  itemsByRow: Map<string, PlacedItem[]>,
): Record<string, number> =>
  Object.fromEntries(
    [...itemsByRow].map(([rowId, items]) => [rowId, items.length]),
  );

export function bind(
  tableId: string,
  config: TableConfig,
  itemsByRow: Map<string, PlacedItem[]>,
): void {
  boundTableId = tableId;
  shownDesign = config;
  post({ type: "edit", tableId, config, counts: countsOf(itemsByRow) });
}

export function unbind(): void {
  if (boundTableId === null) return;
  boundTableId = null;
  post({ type: "edit-cleared" });
}

export function postCounts(
  tableId: string,
  itemsByRow: Map<string, PlacedItem[]>,
): void {
  if (boundTableId !== tableId) return;
  post({ type: "counts", tableId, counts: countsOf(itemsByRow) });
}

export function stylingCssVars(styling: ModuleStyling): string {
  return Object.entries(styling)
    .map(([key, value]) =>
      key === "theme"
        ? `color-scheme: ${value};`
        : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`,
    )
    .join("");
}

export async function handleSelection(ids: string[]): Promise<void> {
  if (ids.length === 0 || !(await touchesUs(ids))) {
    unbind();
    return;
  }

  const scene = await scanScene();
  if (!scene) return;

  const selected = new Set(ids);
  const hit = [...scene.tables.values()].filter((table) =>
    elementIdsOf(table).some((id) => selected.has(id)),
  );
  if (hit.length !== 1) {
    unbind();
    return;
  }

  const [table] = hit;
  bind(table.tableId, table.config, table.items);
}
