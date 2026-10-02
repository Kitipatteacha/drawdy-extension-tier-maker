import { positionsOf, Scene, scanScene } from "../../drawdy-bridge/scene";
import { command } from "../../drawdy-bridge/session";
import { SceneTable } from "../../table/collect";
import { Point } from "../../table/layout";
import { CarryingTable } from "./carrying-table";
import { MovingTable } from "./moving-table";
import { MovingItems } from "./moving-items";
import { DragState } from "./state";

export class Idle extends DragState {
  public override async onDragStart(ids: string[]): Promise<void> {
    const from = await positionsOf(ids);
    if (from.size === 0) return;

    const scene = await scanScene();
    if (!scene) return;

    const grabbed = new Set(ids);
    for (const table of scene.tables.values()) {
      const anchorId = table.partIds.find((id) => grabbed.has(id));
      if (anchorId === undefined) continue;
      await this.machine.transitionTo(
        await this.tableDrag(table, anchorId, grabbed, from, scene),
      );
      return;
    }

    await this.machine.transitionTo(
      new MovingItems(this.machine, [...from.keys()]),
    );
  }

  private async tableDrag(
    table: SceneTable,
    anchorId: string,
    grabbed: Set<string>,
    from: Map<string, Point>,
    scene: Scene,
  ): Promise<DragState> {
    const onRelease = new MovingTable(this.machine, {
      tableId: table.tableId,
      draggedPart: anchorId,
      from,
    });

    const anchorFrom = from.get(anchorId);
    if (!anchorFrom) return onRelease;

    const followers = [...table.rowOfItem.keys()].filter(
      (id) => !grabbed.has(id) && scene.geo.has(id),
    );
    if (followers.length === 0) return onRelease;

    const begun = await command("command:scene:begin-preview", {
      drawdyElementIds: followers,
      holdOnDrag: true,
    });
    if (!begun || begun.began.length === 0) return onRelease;

    return new CarryingTable(this.machine, {
      anchorId,
      anchorFrom,
      followers: begun.began,
    });
  }
}
