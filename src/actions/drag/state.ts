import type { DragMachine } from "./machine";

export abstract class DragState {
  public constructor(protected readonly machine: DragMachine) {}

  public async onExit(): Promise<void> {}

  public async onDragStart(_ids: string[]): Promise<void> {}

  public async onDragging(): Promise<void> {}

  public async onDragEnd(): Promise<void> {}

  public claimTick(): boolean {
    return false;
  }
}
