import { DrawdyElementSchema } from "@drawdy/driver-protocol";

import { TableConfig, DEFAULTS, POOL_ROW_ID } from "./config";
import { LaidTable, PlacedItem } from "./layout";
import {
  TableScalars,
  ITEM_LAYER,
  itemMeta,
  META_KEY,
  PartKind,
  STRUCTURE_LAYER,
  TierMeta,
} from "./meta";
import { SKIN } from "./palette";

const scalarsOf = (config: TableConfig): TableScalars => ({
  width: config.width,
  labelWidth: config.labelWidth,
  rowHeight: config.rowHeight,
  itemHeight: config.itemHeight,
});

function labelFontSize(label: string, cellWidth: number): number {
  const glyphs = Math.max(1, [...label].length);
  const fits = (cellWidth - 16) / (glyphs * 0.62);
  return Math.max(11, Math.min(DEFAULTS.labelFontSize, Math.round(fits)));
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * A part's id is a hash of everything drawn, so every driver that lays out
 * the same table names its parts the same and a second redraw finds them
 * already on the board instead of drawing the rows twice. A row's shapes
 * leave their geometry out, keeping the id when the row only moves or grows,
 * so they are moved and resized in place rather than drawn again. The title
 * keeps it: a text box reads back at its measured size, not the one drawn.
 */
function partId(tableId: string, element: DrawdyElementSchema): string {
  const { x: _x, y: _y, width: _w, height: _h, ...drawn } = element as Record<
    string,
    unknown
  >;
  const content = JSON.stringify(element.type === "text" ? element : drawn);
  return `${tableId}_${fnv1a(content, 0x811c9dc5)}${fnv1a(content, 0x9e3779b9)}`;
}

export function buildTableElements(
  tableId: string,
  config: TableConfig,
  laid: LaidTable,
): DrawdyElementSchema[] {
  const cfg = scalarsOf(config);
  const elements: DrawdyElementSchema[] = [];

  const meta = (part: PartKind, rowId: string): Record<string, unknown> => ({
    [META_KEY]: { v: 1, tableId, part, rowId, cfg } satisfies TierMeta,
  });

  if (laid.titleRect) {
    const rect = laid.titleRect;
    elements.push({
      type: "text",
      drawdyElementId: "",
      x: rect.x,
      y: rect.y + (rect.height - DEFAULTS.titleFontSize * 1.25) / 2,
      width: rect.width,
      text: config.title,
      fontSize: DEFAULTS.titleFontSize,
      color: SKIN.title,
      textAlign: "center",
      layer: STRUCTURE_LAYER,
      groupId: tableId,
      meta: meta("title", ""),
    });
  }

  for (const row of laid.rows) {
    const pool = row.rowId === POOL_ROW_ID;
    elements.push({
      type: "shape",
      componentType: "rect",
      drawdyElementId: "",
      ...row.bodyRect,
      fillColor: SKIN.body,
      strokeColor: SKIN.line,
      strokeWidth: 1,
      fillStyle: "solid",
      roughness: 0,
      cornerRadius: 0,
      layer: STRUCTURE_LAYER,
      groupId: tableId,
      meta: meta("body", row.rowId),
    });
    elements.push({
      type: "shape",
      componentType: "rect",
      drawdyElementId: "",
      ...row.labelRect,
      fillColor: row.color ?? SKIN.body,
      strokeColor: SKIN.line,
      strokeWidth: 1,
      fillStyle: "solid",
      roughness: 0,
      cornerRadius: 0,
      text: row.label,
      fontSize: labelFontSize(row.label, row.labelRect.width),
      textColor: pool ? SKIN.title : SKIN.labelText,
      textAlign: "center",
      textVerticalAlign: "middle",
      layer: STRUCTURE_LAYER,
      groupId: tableId,
      meta: meta("label", row.rowId),
    });
  }

  return elements.map((element) => ({
    ...element,
    drawdyElementId: partId(tableId, element),
  }));
}

export function looseImageElement(
  item: PlacedItem,
  blob: Blob,
): DrawdyElementSchema {
  return {
    type: "image",
    drawdyElementId: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    layer: ITEM_LAYER,
    blob,
  };
}

export function imageElement(
  tableId: string,
  item: PlacedItem,
  rowId: string,
  blob: Blob,
): DrawdyElementSchema {
  return {
    ...looseImageElement(item, blob),
    meta: { [META_KEY]: itemMeta(tableId, rowId) },
  };
}
