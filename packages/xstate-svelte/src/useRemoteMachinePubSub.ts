import { useRemoteMachine, type RemoteMachineAPI, type RemoteSnapshot } from './useRemoteMachine';

/**
 * PubSub adapter interface for webview-side communication
 */
export interface PubSubAdapter {
  /**
   * Subscribe to a topic with a handler
   * @returns Unsubscribe function
   */
  subscribe: <T>(topic: string, handler: (data: T) => void) => () => void;
  /**
   * Publish data to a topic
   */
  publish: <T>(topic: string, data: T) => void;
}

/**
 * Options for useRemoteMachinePubSub
 */
export interface UseRemoteMachinePubSubOptions<TSnapshot, TEvent> {
  /**
   * Optional optimistic reducer for local-first updates
   */
  optimistic?: {
    reducer: (snapshot: TSnapshot, event: TEvent) => TSnapshot;
  };
  /**
   * Initial snapshot to use before receiving from server
   */
  initialSnapshot?: TSnapshot;
  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Event with clientSeq for tracking
 */
interface EventWithSeq<TEvent> {
  event: TEvent;
  clientSeq: number;
}

/**
 * Helper that uses a PubSub adapter to subscribe to machine snapshot topics
 * and publish events. Includes optimistic reducer option and pending replay.
 * Uses svelte/store fallback.
 * 
 * @param pubsub - PubSub adapter instance
 * @param machineId - Unique identifier for the machine
 * @param options - Configuration options
 * @returns RemoteMachineAPI with state, send, requestSnapshot, connected, and pendingCount
 */
export function useRemoteMachinePubSub<TSnapshot, TEvent>(
  pubsub: PubSubAdapter,
  machineId: string,
  options: UseRemoteMachinePubSubOptions<TSnapshot, TEvent> = {}
): RemoteMachineAPI<TSnapshot, TEvent> {
  const snapshotTopic = `machine:${machineId}:snapshot`;
  const eventsTopic = `machine:${machineId}:events`;
  const requestTopic = `machine:${machineId}:request-snapshot`;

  // Create subscribe function for snapshots
  const subscribeFn = (onSnapshot: (snapshot: RemoteSnapshot<TSnapshot>) => void) => {
    return pubsub.subscribe<RemoteSnapshot<TSnapshot>>(snapshotTopic, onSnapshot);
  };

  // Create publish function for events
  const publishEventFn = (event: TEvent, clientSeq: number) => {
    const payload: EventWithSeq<TEvent> = { event, clientSeq };
    pubsub.publish(eventsTopic, payload);
  };

  // Create request snapshot function
  const requestSnapshotFn = () => {
    pubsub.publish(requestTopic, { timestamp: Date.now() });
  };

  // Use the base useRemoteMachine with pubsub wiring
  return useRemoteMachine<TSnapshot, TEvent>(
    subscribeFn,
    publishEventFn,
    requestSnapshotFn,
    options
  );
}
