import { redrawTable } from "./redraw";
import {
  addElements,
  Scene,
  scanScene,
  selectElements,
  Tag,
  tagItems,
  targetTable,
} from "../drawdy-bridge/scene";
import { viewportRect } from "../drawdy-bridge/camera";
import { newElementId, post, status } from "../drawdy-bridge/session";
import { SceneTable } from "../table/collect";
import { DEFAULTS, POOL_ROW_ID, TableConfig } from "../table/config";
import { buildTableElements, looseImageElement } from "../table/draw";
import {
  layoutTable,
  near,
  PlacedItem,
  Point,
  Rect,
  wrapLines,
} from "../table/layout";
import { bind, postCounts, unbind } from "../panel/binding";
import {
  IncomingImage,
  MAX_IMAGES_PER_BATCH,
  MAX_IMAGE_BYTES,
} from "../panel/messages";

async function aimAt(
  tableId: string | null,
  missing: string,
): Promise<{ scene: Scene; table: SceneTable } | null> {
  const scene = await scanScene();
  if (!scene) return null;
  const table = targetTable(scene, tableId);
  if (table) return { scene, table };
  status(missing, "error");
  return null;
}

async function insertTable(next: TableConfig, origin: Point): Promise<void> {
  const tableId = `t_${newElementId()}`;
  const laid = layoutTable(next, origin, new Map());
  if (
    !(await addElements(buildTableElements(tableId, next, laid, newElementId)))
  ) {
    status("The board refused the tier list.", "error");
    return;
  }

  bind(tableId, next, new Map());
  status("Tier list added. Drop images on a row to rank them.");
}

export async function insertAtViewportCenter(next: TableConfig): Promise<void> {
  const view = await viewportRect();
  if (!view) return;
  const size = layoutTable(next, { x: 0, y: 0 }, new Map()).rect;
  await insertTable(next, {
    x: view.x + view.width / 2 - size.width / 2,
    y: view.y + view.height / 2 - size.height / 2,
  });
}

export async function updateTable(
  tableId: string,
  next: TableConfig,
): Promise<void> {
  const scene = await scanScene();
  const table = scene?.tables.get(tableId);
  if (!table) {
    unbind();
    await insertAtViewportCenter(next);
    return;
  }

  const keep = new Set(next.rows.map((row) => row.id));
  const itemsByRow = new Map<string, PlacedItem[]>();
  const retags: Tag[] = [];
  for (const [rowId, items] of table.items) {
    const target = keep.has(rowId) ? rowId : POOL_ROW_ID;
    if (target !== rowId) {
      for (const item of items)
        retags.push({ id: item.id, tableId, rowId: target });
    }
    itemsByRow.set(target, [...(itemsByRow.get(target) ?? []), ...items]);
  }

  await tagItems(retags);
  const drawn = await redrawTable(table, itemsByRow, {
    config: next,
    force: true,
  });
  if (!drawn) return;

  await selectElements(drawn.partIds);
  postCounts(tableId, itemsByRow);
  status("Tier list updated.");
}

type UsableImage = { blob: Blob; width: number; height: number };

function usableImage(image: unknown): UsableImage | null {
  if (typeof image !== "object" || image === null) return null;
  if (typeof Blob !== "function") return null;
  const { bytes, mime, width, height } = image as Partial<IncomingImage>;
  if (!(bytes instanceof ArrayBuffer)) return null;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    blob: new Blob([bytes], {
      type: typeof mime === "string" ? mime : "image/png",
    }),
    width,
    height,
  };
}

const fitToHeight = (
  id: string,
  aspect: number,
  itemHeight: number,
): PlacedItem => ({
  id,
  x: 0,
  y: 0,
  width: aspect * itemHeight,
  height: itemHeight,
});

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

function tableForImages(
  scene: Scene,
  tableId: string | null,
  view: Rect,
): SceneTable | null {
  const aimed = targetTable(scene, tableId);
  if (aimed) return aimed;
  const eye = centreOf(view);
  let nearest: SceneTable | null = null;
  let best = Infinity;
  for (const table of scene.tables.values()) {
    const at = centreOf(
      layoutTable(table.config, table.origin, table.items).rect,
    );
    const distance = (at.x - eye.x) ** 2 + (at.y - eye.y) ** 2;
    if (distance < best) [nearest, best] = [table, distance];
  }
  return nearest;
}

async function dropLoose(images: UsableImage[], view: Rect): Promise<void> {
  const gap = DEFAULTS.gap;
  const blobOf = new Map<string, Blob>();
  const sized = images.map((image) => {
    const item = fitToHeight(
      newElementId(),
      image.width / image.height,
      DEFAULTS.itemHeight,
    );
    blobOf.set(item.id, image.blob);
    return item;
  });

  const lines = wrapLines(sized, view.width * 0.8, gap);
  const eye = centreOf(view);
  const blockHeight = lines.length * (DEFAULTS.itemHeight + gap) - gap;
  let y = eye.y - blockHeight / 2;
  const placed: PlacedItem[] = [];
  for (const line of lines) {
    const lineWidth =
      line.reduce((sum, item) => sum + item.width, 0) + gap * (line.length - 1);
    let x = eye.x - lineWidth / 2;
    for (const item of line) {
      placed.push({ ...item, x, y });
      x += item.width + gap;
    }
    y += DEFAULTS.itemHeight + gap;
  }

  const added = await addElements(
    placed.map((item) => looseImageElement(item, blobOf.get(item.id) as Blob)),
  );
  status(
    added
      ? `Added ${placed.length} image${placed.length === 1 ? "" : "s"} to the canvas. Drag them onto a tier to rank them.`
      : "The board refused the images.",
    added ? "info" : "error",
  );
}

export async function addImages(
  tableId: string | null,
  images: unknown[],
): Promise<void> {
  const usable = images
    .slice(0, MAX_IMAGES_PER_BATCH)
    .map(usableImage)
    .filter((image): image is UsableImage => image !== null);
  if (usable.length === 0) {
    status("None of those files could be read as images.", "error");
    return;
  }

  const scene = await scanScene();
  const view = await viewportRect();
  if (!scene || !view) return;
  const table = tableForImages(scene, tableId, view);
  if (!table) {
    await dropLoose(usable, view);
    return;
  }

  const pending = new Map<string, { blob: Blob }>();
  const arriving = usable.map((image) => {
    const id = newElementId();
    pending.set(id, { blob: image.blob });
    return fitToHeight(id, image.width / image.height, table.config.itemHeight);
  });
  const itemsByRow = new Map(table.items);
  itemsByRow.set(POOL_ROW_ID, [
    ...(table.items.get(POOL_ROW_ID) ?? []),
    ...arriving,
  ]);

  if (!(await redrawTable(table, itemsByRow, { pending }))) {
    status("The board refused the images.", "error");
    return;
  }
  postCounts(table.tableId, itemsByRow);

  const skipped = images.length - usable.length;
  status(
    `Added ${usable.length} image${usable.length === 1 ? "" : "s"}` +
      (skipped > 0 ? `, skipped ${skipped}.` : "."),
  );
}

export async function normalizeTable(tableId: string | null): Promise<void> {
  const aimed = await aimAt(tableId, "Select the tier list to tidy up.");
  if (!aimed) return;
  const { scene, table } = aimed;
  const { itemHeight } = table.config;

  const kinds = new Map(scene.elements.map((el) => [el.id, el.type]));
  const wrong = new Set(
    [...table.items.values()]
      .flat()
      .filter(
        (item) =>
          kinds.get(item.id) === "image" && !near(item.height, itemHeight),
      )
      .map((item) => item.id),
  );
  if (wrong.size === 0) {
    status("Every image is already the right size.");
    return;
  }

  // Same image, same spot in its row, just the right height. The redraw
  // sends every new size and every neighbour shift in one update, so the
  // whole tidy-up is a single undo step.
  const fitted = (item: PlacedItem): PlacedItem => ({
    ...item,
    width: (item.height > 0 ? item.width / item.height : 1) * itemHeight,
    height: itemHeight,
  });
  const itemsByRow = new Map<string, PlacedItem[]>();
  for (const [rowId, items] of table.items) {
    itemsByRow.set(
      rowId,
      items.map((item) => (wrong.has(item.id) ? fitted(item) : item)),
    );
  }

  post({ type: "busy", busy: true });
  try {
    const drawn = await redrawTable(table, itemsByRow);
    status(
      drawn
        ? `Resized ${wrong.size} image${wrong.size === 1 ? "" : "s"}.`
        : "The board refused the resize.",
      drawn ? "info" : "error",
    );
  } finally {
    post({ type: "busy", busy: false });
  }
}

export async function resetTable(tableId: string | null): Promise<void> {
  const aimed = await aimAt(tableId, "Select the tier list to clear.");
  if (!aimed) return;
  const { table } = aimed;

  const retags: Tag[] = [];
  for (const [rowId, items] of table.items) {
    if (rowId === POOL_ROW_ID) continue;
    for (const item of items) {
      retags.push({ id: item.id, tableId: table.tableId, rowId: POOL_ROW_ID });
    }
  }
  if (retags.length === 0) {
    status("Nothing is ranked yet.");
    return;
  }

  await tagItems(retags);
  const pooled = [...table.items.values()].flat();
  const itemsByRow = new Map([[POOL_ROW_ID, pooled]]);
  await redrawTable(table, itemsByRow);
  postCounts(table.tableId, itemsByRow);
  status(
    `Sent ${retags.length} item${retags.length === 1 ? "" : "s"} back to the pool.`,
  );
}
