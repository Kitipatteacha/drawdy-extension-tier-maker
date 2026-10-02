import { positionsOf } from "../../drawdy-bridge/scene";
import { command } from "../../drawdy-bridge/session";
import { moved, Point } from "../../table/layout";
import type { DragMachine } from "./machine";
import { DragState } from "./state";

export type Carry = {
  anchorId: string;
  anchorFrom: Point;
  followers: string[];
};

export class CarryingTable extends DragState {
  private tickPending = false;

  public constructor(
    machine: DragMachine,
    private readonly carry: Carry,
  ) {
    super(machine);
  }

  public override claimTick(): boolean {
    if (this.tickPending) return false;
    this.tickPending = true;
    return true;
  }

  private async anchorDelta(): Promise<Point | null> {
    const { anchorId, anchorFrom } = this.carry;
    const now = (await positionsOf([anchorId])).get(anchorId);
    return now ? { x: now.x - anchorFrom.x, y: now.y - anchorFrom.y } : null;
  }

  public override async onDragging(): Promise<void> {
    this.tickPending = false;
    const delta = await this.anchorDelta();
    if (!delta) return;
    await command("command:scene:preview-transforms", {
      previews: this.carry.followers.map((id) => ({
        drawdyElementId: id,
        transform: { x: delta.x, y: delta.y, scale: 1, rotation: 0 },
      })),
    });
  }

  public override async onDragEnd(): Promise<void> {
    const delta = await this.anchorDelta();
    const commits =
      delta && moved(delta.x, delta.y)
        ? this.carry.followers.map((id) => ({
            drawdyElementId: id,
            dx: delta.x,
            dy: delta.y,
            dRotation: 0,
          }))
        : [];
    await command("command:scene:end-preview", { commits });
  }

  public override async onExit(): Promise<void> {
    await command("command:scene:end-preview", { commits: [] });
  }
}
