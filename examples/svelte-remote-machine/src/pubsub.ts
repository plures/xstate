import type { PubSubAdapter } from '@xstate/svelte';

/**
 * Simple in-memory PubSub implementation for demonstration.
 * In a real application, this would be a message bus, WebSocket, or IPC channel.
 */
export class SimplePubSub implements PubSubAdapter {
  private handlers = new Map<string, Array<(data: any) => void>>();

  subscribe<T>(topic: string, handler: (data: T) => void): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    
    this.handlers.get(topic)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(topic);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  publish<T>(topic: string, data: T): void {
    const handlers = this.handlers.get(topic);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}
