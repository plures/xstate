import type { RemoteSnapshot } from '@xstate/svelte';
import type { SimplePubSub } from './pubsub';

interface CounterSnapshot {
  count: number;
}

type CounterEvent = { type: 'INCREMENT' } | { type: 'DECREMENT' } | { type: 'RESET' };

interface EventWithSeq {
  event: CounterEvent;
  clientSeq: number;
}

/**
 * Mock server that manages counter state and responds to events.
 * Simulates network latency and processes events sequentially.
 */
export class MockServer {
  private state: CounterSnapshot = { count: 0 };
  private serverSeq = 0;
  private networkDelay = 500; // ms

  constructor(private pubsub: SimplePubSub, private machineId: string) {
    this.setupListeners();
    this.sendInitialSnapshot();
  }

  private setupListeners() {
    // Listen for events from client
    this.pubsub.subscribe<EventWithSeq>(
      `machine:${this.machineId}:events`,
      (payload) => {
        this.handleEvent(payload);
      }
    );

    // Listen for snapshot requests
    this.pubsub.subscribe(
      `machine:${this.machineId}:request-snapshot`,
      () => {
        this.sendSnapshot();
      }
    );
  }

  private sendInitialSnapshot() {
    // Send initial state immediately
    setTimeout(() => {
      this.sendSnapshot();
    }, 100);
  }

  private handleEvent(payload: EventWithSeq) {
    const { event, clientSeq } = payload;
    
    console.log(`[Server] Received event:`, event, `clientSeq:`, clientSeq);

    // Simulate network delay
    setTimeout(() => {
      // Process event
      switch (event.type) {
        case 'INCREMENT':
          this.state = { count: this.state.count + 1 };
          break;
        case 'DECREMENT':
          this.state = { count: this.state.count - 1 };
          break;
        case 'RESET':
          this.state = { count: 0 };
          break;
      }

      console.log(`[Server] New state:`, this.state);

      // Send updated snapshot with echo
      this.sendSnapshot(clientSeq);
    }, this.networkDelay);
  }

  private sendSnapshot(echoClientSeq?: number) {
    this.serverSeq++;
    
    const snapshot: RemoteSnapshot<CounterSnapshot> = {
      snapshot: this.state,
      serverSeq: this.serverSeq,
      echoClientSeq
    };

    console.log(`[Server] Sending snapshot:`, snapshot);

    this.pubsub.publish(
      `machine:${this.machineId}:snapshot`,
      snapshot
    );
  }

  setNetworkDelay(delay: number) {
    this.networkDelay = delay;
  }
}
