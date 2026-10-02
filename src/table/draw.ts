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

export function buildTableElements(
  tableId: string,
  config: TableConfig,
  laid: LaidTable,
  generateId: () => string,
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
      drawdyElementId: generateId(),
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
      drawdyElementId: generateId(),
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
      drawdyElementId: generateId(),
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

  return elements;
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
