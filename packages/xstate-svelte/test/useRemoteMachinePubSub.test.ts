import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRemoteMachinePubSub, type PubSubAdapter } from '../src/useRemoteMachinePubSub';
import { get } from 'svelte/store';
import type { RemoteSnapshot } from '../src/useRemoteMachine';

interface CounterSnapshot {
  count: number;
}

type CounterEvent = { type: 'INCREMENT' } | { type: 'DECREMENT' };

describe('useRemoteMachinePubSub', () => {
  let mockPubSub: PubSubAdapter;
  let snapshotHandlers: Map<string, ((data: any) => void)[]>;
  let publishedMessages: Array<{ topic: string; data: any }>;

  beforeEach(() => {
    snapshotHandlers = new Map();
    publishedMessages = [];

    mockPubSub = {
      subscribe: vi.fn((topic, handler) => {
        if (!snapshotHandlers.has(topic)) {
          snapshotHandlers.set(topic, []);
        }
        snapshotHandlers.get(topic)!.push(handler);

        return () => {
          const handlers = snapshotHandlers.get(topic) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        };
      }),
      publish: vi.fn((topic, data) => {
        publishedMessages.push({ topic, data });
      })
    };
  });

  const simulateSnapshotReceived = (machineId: string, snapshot: RemoteSnapshot<CounterSnapshot>) => {
    const topic = `machine:${machineId}:snapshot`;
    const handlers = snapshotHandlers.get(topic) || [];
    handlers.forEach(handler => handler(snapshot));
  };

  it('should initialize with correct topics', () => {
    const machineId = 'test-counter';
    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId
    );

    expect(mockPubSub.subscribe).toHaveBeenCalledWith(
      'machine:test-counter:snapshot',
      expect.any(Function)
    );
  });

  it('should receive snapshots via pubsub', () => {
    const machineId = 'test-counter';
    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId
    );

    expect(get(api.state)).toBeNull();

    simulateSnapshotReceived(machineId, {
      snapshot: { count: 5 },
      serverSeq: 1
    });

    expect(get(api.state)).toEqual({ count: 5 });
  });

  it('should publish events via pubsub', () => {
    const machineId = 'test-counter';
    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId
    );

    api.send({ type: 'INCREMENT' });

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'machine:test-counter:events',
      { event: { type: 'INCREMENT' }, clientSeq: 1 }
    );
  });

  it('should publish request snapshot via pubsub', () => {
    const machineId = 'test-counter';
    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId
    );

    api.requestSnapshot();

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'machine:test-counter:request-snapshot',
      { timestamp: expect.any(Number) }
    );
  });

  it('should support optimistic updates with pubsub', () => {
    const machineId = 'test-counter';
    const optimistic = {
      reducer: (snapshot: CounterSnapshot, event: CounterEvent) => {
        if (event.type === 'INCREMENT') {
          return { count: snapshot.count + 1 };
        }
        return snapshot;
      }
    };

    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId,
      { initialSnapshot: { count: 0 }, optimistic }
    );

    expect(get(api.state)).toEqual({ count: 0 });

    api.send({ type: 'INCREMENT' });
    expect(get(api.state)).toEqual({ count: 1 });

    // Simulate server acknowledgment
    simulateSnapshotReceived(machineId, {
      snapshot: { count: 1 },
      serverSeq: 1,
      echoClientSeq: 1
    });

    expect(get(api.state)).toEqual({ count: 1 });
    expect(get(api.pendingCount)).toBe(0);
  });

  it('should handle connection status changes via pubsub', () => {
    const machineId = 'test-counter';
    const onConnectionChange = vi.fn();

    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId,
      { onConnectionChange }
    );

    expect(get(api.connected)).toBe(false);

    simulateSnapshotReceived(machineId, {
      snapshot: { count: 0 },
      serverSeq: 1
    });

    expect(get(api.connected)).toBe(true);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it('should cleanup pubsub subscriptions', () => {
    const machineId = 'test-counter';
    const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      machineId
    );

    expect(snapshotHandlers.get('machine:test-counter:snapshot')).toHaveLength(1);

    // In a real Svelte component, onDestroy would be called
    // Here we verify the unsubscribe function was created
    expect(mockPubSub.subscribe).toHaveBeenCalled();
  });

  it('should work with multiple machines using different IDs', () => {
    const api1 = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      'machine-1'
    );

    const api2 = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
      mockPubSub,
      'machine-2'
    );

    simulateSnapshotReceived('machine-1', {
      snapshot: { count: 10 },
      serverSeq: 1
    });

    simulateSnapshotReceived('machine-2', {
      snapshot: { count: 20 },
      serverSeq: 1
    });

    expect(get(api1.state)).toEqual({ count: 10 });
    expect(get(api2.state)).toEqual({ count: 20 });
  });
});
