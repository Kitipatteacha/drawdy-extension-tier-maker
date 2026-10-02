import type { TableConfig } from "../table/config";

export type IncomingImage = {
  name: string;
  mime: string;
  bytes: ArrayBuffer;
  width: number;
  height: number;
};

export type WebviewToDriver =
  | { type: "ready" }
  | { type: "insert"; config: TableConfig }
  | { type: "update"; tableId: string; config: TableConfig }
  | { type: "add-images"; tableId: string | null; images: IncomingImage[] }
  | { type: "normalize"; tableId: string }
  | { type: "reset"; tableId: string }
  | { type: "save-config"; config: TableConfig };

export type DriverToWebview =
  | { type: "init"; config: TableConfig | null; css: string }
  | { type: "styling"; css: string }
  | {
      type: "edit";
      tableId: string;
      config: TableConfig;
      counts: Record<string, number>;
    }
  | { type: "edit-cleared" }
  | { type: "counts"; tableId: string; counts: Record<string, number> }
  | { type: "status"; text: string; tone: "info" | "error" }
  | { type: "busy"; busy: boolean };

export const MAX_IMAGES_PER_BATCH = 60;
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
