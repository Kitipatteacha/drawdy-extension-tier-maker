import { Idle } from "./idle";
import { DragState } from "./state";

export class DragMachine {
  private state: DragState = new Idle(this);

  public async transitionTo(next: DragState): Promise<void> {
    await this.state.onExit();
    this.state = next;
  }

  public claimTick(): boolean {
    return this.state.claimTick();
  }

  public async dragStart(ids: string[]): Promise<void> {
    await this.state.onDragStart(ids);
  }

  public async dragging(): Promise<void> {
    await this.state.onDragging();
  }

  public async dragEnd(): Promise<void> {
    await this.state.onDragEnd();
    this.state = new Idle(this);
  }
}

export const drag = new DragMachine();
