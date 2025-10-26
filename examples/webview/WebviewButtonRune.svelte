<script lang="ts">
/**
 * Rune-first Svelte 5 example component using the rune-native helper.
 * 
 * Demonstrates:
 * - Subscribing to snapshots from extension host
 * - Publishing events with {type:'click', sender:buttonId}
 * - Deterministic UI driven by context.button.label.value
 * - Optimistic usage example (reducer toggling a transient spinner flag)
 */

import { createWebviewPubSubAdapter } from './webview-pubsub-adapter';
import { useRemoteMachineRunes } from '@xstate/svelte';
import type { RemoteSnapshot } from '@xstate/svelte';

// Define types for our machine state
interface ButtonConfig {
  label: {
    value: string;
  };
}

interface MachineContext {
  buttons: {
    [buttonId: string]: ButtonConfig;
  };
  clickCount: number;
}

interface MachineSnapshot {
  context: MachineContext;
  value: string;
}

type MachineEvent =
  | { type: 'click'; sender: string }
  | { type: 'updateLabel'; buttonId: string; label: string };

// Props
let { buttonId = 'button1', machineId = 'app' } = $props();

// Create PubSub adapter
const adapter = createWebviewPubSubAdapter();

// Svelte 5 runes (these would normally be imported from 'svelte' or similar)
// For demonstration, we'll use $state and $derived
const runes = {
  state: <T>(initialValue: T) => {
    let value = $state(initialValue);
    return {
      get current() { return value; },
      set current(newValue: T) { value = newValue; }
    };
  },
  derived: <T>(compute: () => T) => {
    let value = $derived(compute());
    return {
      get current() { return value; }
    };
  },
  effect: (fn: () => void | (() => void)) => {
    $effect(() => fn());
  }
};

// Optimistic reducer: toggles a transient 'pending' flag during click
interface OptimisticSnapshot extends MachineSnapshot {
  optimistic?: {
    pending?: boolean;
  };
}

const optimisticReducer = (
  snapshot: OptimisticSnapshot,
  event: MachineEvent
): OptimisticSnapshot => {
  if (event.type === 'click') {
    return {
      ...snapshot,
      optimistic: { pending: true }
    };
  }
  return snapshot;
};

// Setup remote machine with runes
const snapshotTopic = `machine:${machineId}:snapshot`;
const eventsTopic = `machine:${machineId}:events`;
const requestTopic = `machine:${machineId}:request-snapshot`;

const subscribeFn = (onSnapshot: (snapshot: RemoteSnapshot<OptimisticSnapshot>) => void) => {
  return adapter.subscribe<RemoteSnapshot<OptimisticSnapshot>>(snapshotTopic, onSnapshot);
};

const publishEventFn = (event: MachineEvent, clientSeq: number) => {
  adapter.publish(eventsTopic, { event, clientSeq });
};

const requestSnapshotFn = () => {
  adapter.publish(requestTopic, { timestamp: Date.now() });
};

const remote = useRemoteMachineRunes<OptimisticSnapshot, MachineEvent>(
  subscribeFn,
  publishEventFn,
  requestSnapshotFn,
  runes,
  {
    optimistic: {
      reducer: optimisticReducer
    }
  }
);

// Derived button label and state
const buttonLabel = $derived(() => {
  const state = remote.state.current;
  if (!state) return 'Loading...';
  
  const button = state.context.buttons[buttonId];
  return button ? button.label.value : 'Unknown Button';
});

const isPending = $derived(() => {
  const state = remote.state.current;
  return state?.optimistic?.pending ?? false;
});

const isConnected = $derived(() => remote.connected.current);
const clickCount = $derived(() => {
  const state = remote.state.current;
  return state?.context.clickCount ?? 0;
});

// Handle click
function handleClick() {
  remote.send({ type: 'click', sender: buttonId });
}
</script>

<div class="button-component">
  <h3>Button: {buttonId}</h3>
  
  <button
    on:click={handleClick}
    disabled={!isConnected() || isPending()}
    class:pending={isPending()}
  >
    {buttonLabel()}
    {#if isPending()}
      <span class="spinner">⏳</span>
    {/if}
  </button>
  
  <div class="status">
    <span class="indicator" class:connected={isConnected()}>
      {isConnected() ? '🟢' : '🔴'}
    </span>
    {isConnected() ? 'Connected' : 'Disconnected'}
  </div>
  
  <div class="info">
    Total clicks: {clickCount()}
  </div>
  
  {#if remote.pendingCount.current > 0}
    <div class="pending-count">
      Pending events: {remote.pendingCount.current}
    </div>
  {/if}
</div>

<style>
  .button-component {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin: 1rem;
    font-family: sans-serif;
  }

  button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    border: none;
    border-radius: 4px;
    background-color: #007acc;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #005a9e;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  button.pending {
    background-color: #ffa500;
  }

  .spinner {
    margin-left: 0.5rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .status {
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .indicator {
    font-size: 1.2rem;
  }

  .info, .pending-count {
    margin-top: 0.5rem;
    color: #666;
    font-size: 0.9rem;
  }

  .pending-count {
    color: #ff6600;
    font-weight: bold;
  }
</style>
