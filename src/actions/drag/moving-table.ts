import { moveElements, scanScene } from "../../drawdy-bridge/scene";
import { moved, Point } from "../../table/layout";
import type { DragMachine } from "./machine";
import { DragState } from "./state";

export type TableMove = {
  tableId: string;
  draggedPart: string;
  from: Map<string, Point>;
};

export class MovingTable extends DragState {
  public constructor(
    machine: DragMachine,
    private readonly move: TableMove,
  ) {
    super(machine);
  }

  public override async onDragEnd(): Promise<void> {
    const { tableId, draggedPart, from } = this.move;
    const scene = await scanScene();
    const table = scene?.tables.get(tableId);
    if (!scene || !table) return;

    const before = from.get(draggedPart);
    const after = scene.geo.get(draggedPart);
    if (!before || !after) return;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    if (!moved(dx, dy)) return;

    const rest = [...table.rowOfItem.keys()].filter(
      (id) => !from.has(id) && scene.geo.has(id),
    );
    await moveElements(rest.map((id) => ({ id, dx, dy })));
  }
}
