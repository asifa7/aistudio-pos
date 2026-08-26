import { EventEmitter } from 'events';

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Increase listener limits if many modules hook in
    this.emitter.setMaxListeners(50);
  }

  public publish(event: string, payload?: any): void {
    this.emitter.emit(event, payload);
  }

  public subscribe(event: string, listener: (payload?: any) => void): void {
    this.emitter.on(event, listener);
  }

  public unsubscribe(event: string, listener: (payload?: any) => void): void {
    this.emitter.off(event, listener);
  }
}

export const eventBus = new EventBus();
