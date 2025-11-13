import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { useRemoteMachine, type RemoteSnapshot } from '../src/useRemoteMachine';

interface CounterSnapshot {
  count: number;
}

type CounterEvent = { type: 'INCREMENT' } | { type: 'DECREMENT' };

describe('useRemoteMachine', () => {
  let subscribeFn: ReturnType<typeof vi.fn>;
  let publishEventFn: ReturnType<typeof vi.fn>;
  let requestSnapshotFn: ReturnType<typeof vi.fn>;
  let snapshotHandler: ((snapshot: RemoteSnapshot<CounterSnapshot>) => void) | null;

  beforeEach(() => {
    snapshotHandler = null;
    subscribeFn = vi.fn((handler) => {
      snapshotHandler = handler;
      return () => {
        snapshotHandler = null;
      };
    });
    publishEventFn = vi.fn();
    requestSnapshotFn = vi.fn();
  });

  it('should initialize with null state when no initialSnapshot provided', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    expect(get(api.state)).toBeNull();
    expect(get(api.connected)).toBe(false);
    expect(get(api.pendingCount)).toBe(0);
  });

  it('should initialize with initialSnapshot when provided', () => {
    const initialSnapshot: CounterSnapshot = { count: 5 };
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      { initialSnapshot }
    );

    expect(get(api.state)).toEqual({ count: 5 });
  });

  it('should update state when receiving snapshots', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    // Simulate receiving a snapshot
    snapshotHandler?.({
      snapshot: { count: 10 },
      serverSeq: 1
    });

    expect(get(api.state)).toEqual({ count: 10 });
    expect(get(api.connected)).toBe(true);
  });

  it('should ignore snapshots with non-monotonic serverSeq', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    // First snapshot
    snapshotHandler?.({
      snapshot: { count: 10 },
      serverSeq: 2
    });

    expect(get(api.state)).toEqual({ count: 10 });

    // Try to send older snapshot
    snapshotHandler?.({
      snapshot: { count: 5 },
      serverSeq: 1
    });

    // State should not change
    expect(get(api.state)).toEqual({ count: 10 });
  });

  it('should send events with clientSeq', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    api.send({ type: 'INCREMENT' });
    api.send({ type: 'DECREMENT' });

    expect(publishEventFn).toHaveBeenCalledTimes(2);
    expect(publishEventFn).toHaveBeenNthCalledWith(1, { type: 'INCREMENT' }, 1);
    expect(publishEventFn).toHaveBeenNthCalledWith(2, { type: 'DECREMENT' }, 2);
  });

  it('should track pending events', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    expect(get(api.pendingCount)).toBe(0);

    api.send({ type: 'INCREMENT' });
    expect(get(api.pendingCount)).toBe(1);

    api.send({ type: 'INCREMENT' });
    expect(get(api.pendingCount)).toBe(2);
  });

  it('should remove acknowledged pending events', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    // Send two events
    api.send({ type: 'INCREMENT' });
    api.send({ type: 'INCREMENT' });

    expect(get(api.pendingCount)).toBe(2);

    // Receive snapshot acknowledging first event
    snapshotHandler?.({
      snapshot: { count: 1 },
      serverSeq: 1,
      echoClientSeq: 1
    });

    expect(get(api.pendingCount)).toBe(1);

    // Acknowledge second event
    snapshotHandler?.({
      snapshot: { count: 2 },
      serverSeq: 2,
      echoClientSeq: 2
    });

    expect(get(api.pendingCount)).toBe(0);
  });

  it('should apply optimistic updates', () => {
    const optimistic = {
      reducer: (snapshot: CounterSnapshot, event: CounterEvent) => {
        if (event.type === 'INCREMENT') {
          return { count: snapshot.count + 1 };
        }
        if (event.type === 'DECREMENT') {
          return { count: snapshot.count - 1 };
        }
        return snapshot;
      }
    };

    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      { initialSnapshot: { count: 0 }, optimistic }
    );

    expect(get(api.state)).toEqual({ count: 0 });

    // Send event - should apply optimistic update
    api.send({ type: 'INCREMENT' });
    expect(get(api.state)).toEqual({ count: 1 });

    api.send({ type: 'INCREMENT' });
    expect(get(api.state)).toEqual({ count: 2 });

    // Receive server snapshot - should replace optimistic state
    snapshotHandler?.({
      snapshot: { count: 2 },
      serverSeq: 1,
      echoClientSeq: 2
    });

    expect(get(api.state)).toEqual({ count: 2 });
    expect(get(api.pendingCount)).toBe(0);
  });

  it('should call onConnectionChange callback', () => {
    const onConnectionChange = vi.fn();
    
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      { onConnectionChange }
    );

    expect(onConnectionChange).not.toHaveBeenCalled();

    // Receive first snapshot
    snapshotHandler?.({
      snapshot: { count: 0 },
      serverSeq: 1
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(onConnectionChange).toHaveBeenCalledTimes(1);

    // Subsequent snapshots should not trigger callback
    snapshotHandler?.({
      snapshot: { count: 1 },
      serverSeq: 2
    });

    expect(onConnectionChange).toHaveBeenCalledTimes(1);
  });

  it('should call requestSnapshot function', () => {
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn
    );

    api.requestSnapshot();

    expect(requestSnapshotFn).toHaveBeenCalledTimes(1);
  });

  it('should support SSR-friendly initialization', () => {
    // In SSR context, no subscriptions should fail
    const api = useRemoteMachine<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      { initialSnapshot: { count: 42 } }
    );

    // Should initialize with snapshot without errors
    expect(get(api.state)).toEqual({ count: 42 });
  });
});
