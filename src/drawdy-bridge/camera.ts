import { Rect } from "../table/layout";
import { command } from "./session";

export async function viewportRect(): Promise<Rect | null> {
  const view = await command("command:camera:get-viewport-rect");
  return view?.rect ?? null;
}

export type CameraPose = { rect: Rect; zoom: number };

export async function cameraPose(): Promise<CameraPose | null> {
  const rect = await viewportRect();
  if (!rect) return null;
  const info = await command("command:camera:get-info");
  return info ? { rect, zoom: info.zoom } : null;
}

export async function restoreCamera(pose: CameraPose): Promise<void> {
  await command("command:camera:fly-to-rect", {
    rect: pose.rect,
    flyDurationMs: 0,
    zoom: pose.zoom,
  });
}
