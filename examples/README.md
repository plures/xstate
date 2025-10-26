# Remote Machine Examples for VS Code Extensions

This directory contains example implementations for using XState remote machines with Svelte 5 in VS Code extensions.

## Overview

These examples demonstrate how to synchronize XState machines between a VS Code extension host and webview panels using a pub/sub architecture with optimistic updates.

## Architecture

### Extension Host (`extension-host/`)

The extension host runs the authoritative machine and coordinates communication:

- **`pubsub-broker.ts`**: Central message broker that:
  - Manages communication between extension host and webviews
  - Retains last snapshot for each machine
  - Multicasts updates to all attached webviews
  - Echoes `clientSeq` in snapshots to acknowledge events

- **`app-machine.ts`**: Example application machine that:
  - Stores button labels in context
  - Handles click events from webviews
  - Publishes snapshots to `machine:{id}:snapshot`
  - Subscribes to events from `machine:{id}:events`
  - Echoes `clientSeq` when acknowledging events

### Webview (`webview/`)

The webview side consumes the remote machine state:

- **`webview-pubsub-adapter.ts`**: Client-side adapter that:
  - Uses `acquireVsCodeApi()` for VS Code webview communication
  - Falls back to `window.postMessage` for development
  - Provides `subscribe` and `publish` methods
  - Handles bidirectional message flow

- **`WebviewButtonRune.svelte`**: Svelte 5 component demonstrating:
  - Rune-first reactive API (using `$state`, `$derived`, `$effect`)
  - Subscribing to machine snapshots
  - Sending events with `clientSeq` tracking
  - Optimistic updates with spinner during pending events
  - Deterministic UI driven by machine context

## Usage

### Extension Host Setup

```typescript
import { createBroker } from './extension-host/pubsub-broker';
import { wireAppMachineToBroker } from './extension-host/app-machine';

// Create broker
const broker = createBroker();

// Wire machine to broker
const actor = wireAppMachineToBroker(broker, 'myApp');

// Attach webview panels
const cleanup = broker.attachWebviewPanel(panel);
```

### Webview Setup

```svelte
<script lang="ts">
import { createWebviewPubSubAdapter } from './webview/webview-pubsub-adapter';
import { WebviewButtonRune } from './webview/WebviewButtonRune.svelte';

const adapter = createWebviewPubSubAdapter();
</script>

<WebviewButtonRune buttonId="button1" machineId="myApp" />
<WebviewButtonRune buttonId="button2" machineId="myApp" />
```

## Key Features

### Serializable Snapshots
All snapshots include:
- `snapshot`: The actual machine snapshot
- `serverSeq`: Server sequence number for ordering
- `echoClientSeq`: Optional client sequence echo for acknowledgment

### Optimistic Updates
The webview can apply optimistic reducers for immediate UI feedback:
```typescript
const optimisticReducer = (snapshot, event) => {
  if (event.type === 'click') {
    return { ...snapshot, optimistic: { pending: true } };
  }
  return snapshot;
};
```

### ClientSeq/ServerSeq
- `clientSeq`: Client assigns to each event for tracking
- `serverSeq`: Server assigns to each snapshot for ordering
- `echoClientSeq`: Server echoes back to acknowledge receipt

### Connection Status
The remote machine API provides:
- `state`: Current snapshot (with optimistic updates applied)
- `send`: Send events to the remote machine
- `requestSnapshot`: Request a fresh snapshot
- `connected`: Connection status
- `pendingCount`: Number of unacknowledged events

## Implementation Notes

1. **Authoritative Host**: The extension host machine is always authoritative. Optimistic updates are for UI responsiveness only.

2. **Deterministic Reducers**: Optimistic reducers must be small, deterministic, and fast. They should only affect transient UI state, not core business logic.

3. **Sequence Numbers**: The broker ensures monotonic `serverSeq` and removes acknowledged events based on `echoClientSeq`.

4. **Svelte 5 Runes**: The `useRemoteMachineRunes` implementation uses native Svelte 5 runes (`$state`, `$derived`, `$effect`) for optimal reactivity.

5. **Fallback Support**: For non-Svelte 5 projects, `useRemoteMachine` provides a `svelte/store` fallback implementation.

## Files

- `extension-host/pubsub-broker.ts` - Message broker for extension host
- `extension-host/app-machine.ts` - Example authoritative machine
- `webview/webview-pubsub-adapter.ts` - Webview PubSub adapter
- `webview/WebviewButtonRune.svelte` - Svelte 5 button component example

## Development

For local development without VS Code:
1. The adapter automatically falls back to `window.postMessage`
2. Set up a mock parent window to handle messages
3. Use browser DevTools to debug message flow

## License

MIT
