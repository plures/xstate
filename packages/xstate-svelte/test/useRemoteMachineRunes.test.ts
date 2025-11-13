import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRemoteMachineRunes, type RuneUtils, type RemoteSnapshot } from '../src/useRemoteMachine.runes';

interface CounterSnapshot {
  count: number;
}

type CounterEvent = { type: 'INCREMENT' } | { type: 'DECREMENT' };

describe('useRemoteMachineRunes', () => {
  let subscribeFn: ReturnType<typeof vi.fn>;
  let publishEventFn: ReturnType<typeof vi.fn>;
  let requestSnapshotFn: ReturnType<typeof vi.fn>;
  let snapshotHandler: ((snapshot: RemoteSnapshot<CounterSnapshot>) => void) | null;
  let effectCleanups: Array<() => void>;

  // Mock rune utilities for Svelte 5
  const createMockRunes = (): RuneUtils => {
    effectCleanups = [];
    
    return {
      state: <T>(initialValue: T) => {
        let value = initialValue;
        return {
          get current() { return value; },
          set current(newValue: T) { value = newValue; }
        };
      },
      derived: <T>(compute: () => T) => {
        return {
          get current() { return compute(); }
        };
      },
      effect: (fn: () => void | (() => void)) => {
        const cleanup = fn();
        if (cleanup) {
          effectCleanups.push(cleanup);
        }
      }
    };
  };

  beforeEach(() => {
    snapshotHandler = null;
    effectCleanups = [];
    
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
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    expect(api.state.current).toBeNull();
    expect(api.connected.current).toBe(false);
    expect(api.pendingCount.current).toBe(0);
  });

  it('should initialize with initialSnapshot when provided', () => {
    const runes = createMockRunes();
    const initialSnapshot: CounterSnapshot = { count: 5 };
    
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes,
      { initialSnapshot }
    );

    expect(api.state.current).toEqual({ count: 5 });
  });

  it('should update state when receiving snapshots', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    snapshotHandler?.({
      snapshot: { count: 10 },
      serverSeq: 1
    });

    expect(api.state.current).toEqual({ count: 10 });
    expect(api.connected.current).toBe(true);
  });

  it('should ignore snapshots with non-monotonic serverSeq', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    snapshotHandler?.({
      snapshot: { count: 10 },
      serverSeq: 2
    });

    expect(api.state.current).toEqual({ count: 10 });

    snapshotHandler?.({
      snapshot: { count: 5 },
      serverSeq: 1
    });

    expect(api.state.current).toEqual({ count: 10 });
  });

  it('should send events with clientSeq', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    api.send({ type: 'INCREMENT' });
    api.send({ type: 'DECREMENT' });

    expect(publishEventFn).toHaveBeenCalledTimes(2);
    expect(publishEventFn).toHaveBeenNthCalledWith(1, { type: 'INCREMENT' }, 1);
    expect(publishEventFn).toHaveBeenNthCalledWith(2, { type: 'DECREMENT' }, 2);
  });

  it('should track pending events with derived', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    expect(api.pendingCount.current).toBe(0);

    api.send({ type: 'INCREMENT' });
    expect(api.pendingCount.current).toBe(1);

    api.send({ type: 'INCREMENT' });
    expect(api.pendingCount.current).toBe(2);
  });

  it('should remove acknowledged pending events', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    api.send({ type: 'INCREMENT' });
    api.send({ type: 'INCREMENT' });

    expect(api.pendingCount.current).toBe(2);

    snapshotHandler?.({
      snapshot: { count: 1 },
      serverSeq: 1,
      echoClientSeq: 1
    });

    expect(api.pendingCount.current).toBe(1);

    snapshotHandler?.({
      snapshot: { count: 2 },
      serverSeq: 2,
      echoClientSeq: 2
    });

    expect(api.pendingCount.current).toBe(0);
  });

  it('should apply optimistic updates with derived', () => {
    const runes = createMockRunes();
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

    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes,
      { initialSnapshot: { count: 0 }, optimistic }
    );

    expect(api.state.current).toEqual({ count: 0 });

    api.send({ type: 'INCREMENT' });
    expect(api.state.current).toEqual({ count: 1 });

    api.send({ type: 'INCREMENT' });
    expect(api.state.current).toEqual({ count: 2 });

    snapshotHandler?.({
      snapshot: { count: 2 },
      serverSeq: 1,
      echoClientSeq: 2
    });

    expect(api.state.current).toEqual({ count: 2 });
    expect(api.pendingCount.current).toBe(0);
  });

  it('should work without derived rune (fallback mode)', () => {
    const runesWithoutDerived: RuneUtils = {
      state: <T>(initialValue: T) => {
        let value = initialValue;
        return {
          get current() { return value; },
          set current(newValue: T) { value = newValue; }
        };
      }
    };

    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runesWithoutDerived,
      { initialSnapshot: { count: 0 } }
    );

    expect(api.state.current).toEqual({ count: 0 });

    api.send({ type: 'INCREMENT' });
    // Pending count should still be tracked manually
    expect(api.pendingCount.current).toBe(1);
  });

  it('should setup cleanup effect when effect rune provided', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    expect(effectCleanups.length).toBe(1);
    
    // Trigger cleanup
    effectCleanups[0]();
    
    // After cleanup, snapshotHandler should be null
    expect(snapshotHandler).toBeNull();
  });

  it('should call onConnectionChange callback', () => {
    const runes = createMockRunes();
    const onConnectionChange = vi.fn();
    
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes,
      { onConnectionChange }
    );

    expect(onConnectionChange).not.toHaveBeenCalled();

    snapshotHandler?.({
      snapshot: { count: 0 },
      serverSeq: 1
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(onConnectionChange).toHaveBeenCalledTimes(1);
  });

  it('should call requestSnapshot function', () => {
    const runes = createMockRunes();
    const api = useRemoteMachineRunes<CounterSnapshot, CounterEvent>(
      subscribeFn,
      publishEventFn,
      requestSnapshotFn,
      runes
    );

    api.requestSnapshot();

    expect(requestSnapshotFn).toHaveBeenCalledTimes(1);
  });
});
