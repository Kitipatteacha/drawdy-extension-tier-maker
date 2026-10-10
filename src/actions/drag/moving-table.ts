import { commitEdit, emptyEdit, scanScene } from "../../drawdy-bridge/scene";
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

    const rest = [...table.rowOfItem.keys()].flatMap((id) => {
      const at = scene.geo.get(id);
      return at && !from.has(id) ? [{ id, x: at.x + dx, y: at.y + dy }] : [];
    });
    await commitEdit({ ...emptyEdit(), placements: rest });
  }
}
