# @xstate/svelte

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [Svelte](https://github.com/sveltejs/svelte).

- [Read the full documentation in the XState docs](https://stately.ai/docs/xstate-svelte).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Features

- 🎯 **Full XState v5 Support** - Works with all XState actor types (machines, promises, observables, etc.)
- 🔄 **Reactive Stores** - Automatic Svelte store integration for state updates
- 🧹 **Automatic Cleanup** - Actors are stopped when components unmount
- 🎭 **TypeScript Support** - Fully typed APIs with generics
- 🌐 **Remote Machines** - Built-in support for client-server state synchronization
- ⚡ **Svelte 5 Ready** - Includes rune-based APIs for Svelte 5

## Quick Start

1. Install `xstate` and `@xstate/svelte`:

```bash
npm i xstate @xstate/svelte
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/svelte/dist/xstate-svelte.min.js"></script>
```

By using the global variable `XStateSvelte`

2. Import `useMachine`

```svelte
<script>
  import { useMachine } from '@xstate/svelte';
  import { createMachine } from 'xstate';

  const toggleMachine = createMachine({
    id: 'toggle',
    initial: 'inactive',
    states: {
      inactive: {
        on: { TOGGLE: 'active' }
      },
      active: {
        on: { TOGGLE: 'inactive' }
      }
    }
  });

  const { snapshot, send } = useMachine(toggleMachine);
</script>

<button on:click={() => send({ type: 'TOGGLE' })}>
  {$snapshot.value === 'inactive'
    ? 'Click to activate'
    : 'Active! Click to deactivate'}
</button>
```

## API Reference

### `useActor(logic, options?)`

Creates an actor from any XState logic and returns a reactive Svelte store for state updates.

**Parameters:**
- `logic` - XState actor logic (machine, promise, observable, etc.)
- `options` - Actor configuration (context, input, snapshot for rehydration, etc.)

**Returns:**
- `snapshot` - Readable Svelte store with current state
- `send` - Function to send events to the actor
- `actorRef` - Direct reference to the actor

```svelte
<script>
  import { useActor } from '@xstate/svelte';
  import { createMachine } from 'xstate';

  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { START: 'running' } },
      running: { on: { STOP: 'idle' } }
    }
  });

  const { snapshot, send, actorRef } = useActor(machine);
</script>

<div>State: {$snapshot.value}</div>
<button on:click={() => send({ type: 'START' })}>Start</button>
```

### `useMachine(machine, options?)`

Alias for `useActor` specifically for state machines. Use when you want to be explicit about working with machines.

```svelte
<script>
  import { useMachine } from '@xstate/svelte';
  const { snapshot, send } = useMachine(machine);
</script>
```

### `useActorRef(logic, options?)`

Creates and starts an actor, returning a direct reference. Use when you need to call actor methods directly.

**Returns:** `Actor<TLogic>` - Started actor that will be stopped on component unmount

```svelte
<script>
  import { useActorRef } from '@xstate/svelte';
  
  const actorRef = useActorRef(machine);
  
  // Direct actor access
  const snapshot = actorRef.getSnapshot();
  actorRef.send({ type: 'EVENT' });
  actorRef.subscribe((snapshot) => {
    console.log('State changed:', snapshot);
  });
</script>
```

### `useSelector(actor, selector, compare?)`

Creates a Svelte store that subscribes to a derived value from an actor's state. Optimizes re-renders by only updating when the selected value changes.

**Parameters:**
- `actor` - Actor reference to select from
- `selector` - Function that extracts a value from the snapshot
- `compare` - Optional comparison function (defaults to `===`)

```svelte
<script>
  import { useActor, useSelector } from '@xstate/svelte';
  
  const { actorRef } = useActor(machine);
  
  // Only re-renders when count changes
  const count = useSelector(actorRef, (state) => state.context.count);
</script>

<div>Count: {$count}</div>
```

### `useRemoteMachine(subscribeFn, publishEventFn, requestSnapshotFn, options?)`

Manages synchronization with a remote machine via snapshot updates and event sending. Supports optimistic updates and pending event tracking.

**Use Cases:**
- Client-server state synchronization
- VSCode webview extensions
- Real-time collaborative applications
- Offline-first applications

**Options:**
- `initialSnapshot` - Initial state before receiving from server
- `optimistic.reducer` - Function to apply optimistic updates locally
- `onConnectionChange` - Callback when connection status changes

```svelte
<script>
  import { useRemoteMachine } from '@xstate/svelte';
  
  const api = useRemoteMachine(
    (onSnapshot) => subscribe(onSnapshot),
    (event, clientSeq) => publish(event, clientSeq),
    () => requestSnapshot(),
    {
      optimistic: {
        reducer: (snapshot, event) => {
          // Apply event optimistically
          return newSnapshot;
        }
      }
    }
  );
  
  $: state = $api.state;
  $: connected = $api.connected;
  $: pendingCount = $api.pendingCount;
</script>
```

### `useRemoteMachinePubSub(pubsub, machineId, options?)`

Helper that uses a PubSub adapter for remote machine communication. Simpler API built on top of `useRemoteMachine`.

**Parameters:**
- `pubsub` - PubSub adapter with `subscribe` and `publish` methods
- `machineId` - Unique identifier for the machine
- `options` - Same as `useRemoteMachine` options

```svelte
<script>
  import { useRemoteMachinePubSub } from '@xstate/svelte';
  
  const api = useRemoteMachinePubSub(pubsub, 'counter', {
    initialSnapshot: { count: 0 },
    optimistic: {
      reducer: (snapshot, event) => {
        if (event.type === 'INCREMENT') {
          return { count: snapshot.count + 1 };
        }
        return snapshot;
      }
    }
  });
</script>
```

See the [svelte-remote-machine example](../../examples/svelte-remote-machine) for a complete working demonstration.

### `useRemoteMachineRunes(subscribeFn, publishEventFn, requestSnapshotFn, runes, options?)`

Svelte 5 rune-first implementation of `useRemoteMachine`. Uses native Svelte 5 reactivity instead of stores.

**Parameters:**
- `runes` - Object with `state`, `derived?`, and `effect?` rune creators
- Other parameters same as `useRemoteMachine`

```svelte
<script>
  import { useRemoteMachineRunes } from '@xstate/svelte';
  
  const api = useRemoteMachineRunes(
    subscribeFn,
    publishEventFn,
    requestSnapshotFn,
    {
      state: $state,
      derived: $derived,
      effect: $effect
    },
    options
  );
  
  // Use rune API directly
  const count = api.state.current;
  const isConnected = api.connected.current;
</script>
```

## TypeScript Support

All APIs are fully typed with generics:

```typescript
import { useActor } from '@xstate/svelte';
import { createMachine } from 'xstate';

const machine = createMachine({
  types: {} as {
    context: { count: number };
    events: { type: 'INCREMENT' } | { type: 'DECREMENT' };
  },
  // ... machine definition
});

const { snapshot, send } = useActor(machine);

// snapshot is typed as Readable<SnapshotFrom<typeof machine>>
// send only accepts { type: 'INCREMENT' } | { type: 'DECREMENT' }
```

## Compatibility

- **Svelte**: 3.24.1+ and 4.x, 5.x
- **XState**: 5.x
- **Node**: 18+

## Examples

- [Counter with Toggle](../../templates/svelte-ts) - Basic usage of `useMachine`
- [Remote Machine Sync](../../examples/svelte-remote-machine) - Client-server state synchronization with optimistic updates

## Migration from v4

**Key Changes:**
- `useService` → `useActor` or `useMachine`
- `state` → `snapshot` (returned value is now called `snapshot`)
- Events must be objects: `send('TOGGLE')` → `send({ type: 'TOGGLE' })`
- Actor automatically starts (no need to call `start()`)
- New APIs: `useActorRef`, `useRemoteMachine`, `useRemoteMachineRunes`, `useRemoteMachinePubSub`

```svelte
<!-- v4 -->
<script>
  import { useMachine } from '@xstate/svelte';
  const { state, send } = useMachine(machine);
</script>
<div>{$state.value}</div>

<!-- v5 -->
<script>
  import { useMachine } from '@xstate/svelte';
  const { snapshot, send } = useMachine(machine);
</script>
<div>{$snapshot.value}</div>
```

## Learn More

- [XState Documentation](https://stately.ai/docs/xstate)
- [@xstate/svelte Documentation](https://stately.ai/docs/xstate-svelte)
- [XState v5 Migration Guide](https://stately.ai/docs/migration)

