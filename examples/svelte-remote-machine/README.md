# Svelte Remote Machine Example

This example demonstrates how to use the `useRemoteMachine` and `useRemoteMachinePubSub` APIs from `@xstate/svelte` to synchronize state with a remote server or extension host.

## Features

- **Optimistic Updates**: Local state updates immediately while waiting for server confirmation
- **Pending Event Tracking**: Visual indication of events awaiting acknowledgment
- **Connection Status**: Real-time connection state monitoring
- **Server Reconciliation**: Automatic conflict resolution when server state differs

## Use Cases

This pattern is ideal for:
- VSCode webview extensions communicating with the extension host
- Real-time collaborative applications
- Offline-first applications with eventual consistency
- Client-server state synchronization

## Running the Example

```bash
pnpm install
pnpm dev
```

## Architecture

The example simulates a client-server architecture:
- **Client**: Svelte component using `useRemoteMachinePubSub`
- **Mock Server**: Simulates network delays and state management
- **PubSub Adapter**: Message bus for communication

## API Usage

### Basic Setup

```typescript
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

// Reactive state
$: state = api.state;
$: connected = api.connected;
$: pendingCount = api.pendingCount;

// Send events
api.send({ type: 'INCREMENT' });
```

## Learn More

- [XState Svelte Documentation](https://stately.ai/docs/xstate-svelte)
- [XState Documentation](https://stately.ai/docs/xstate)
