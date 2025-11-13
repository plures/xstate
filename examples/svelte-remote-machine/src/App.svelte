<script lang="ts">
  import { useRemoteMachinePubSub } from '@xstate/svelte';
  import { SimplePubSub } from './pubsub';
  import { MockServer } from './mockServer';

  // Types
  interface CounterSnapshot {
    count: number;
  }

  type CounterEvent = 
    | { type: 'INCREMENT' }
    | { type: 'DECREMENT' }
    | { type: 'RESET' };

  // Setup PubSub and mock server
  const pubsub = new SimplePubSub();
  const machineId = 'counter';
  const server = new MockServer(pubsub, machineId);

  // Initialize remote machine with optimistic updates
  const api = useRemoteMachinePubSub<CounterSnapshot, CounterEvent>(
    pubsub,
    machineId,
    {
      optimistic: {
        reducer: (snapshot, event) => {
          switch (event.type) {
            case 'INCREMENT':
              return { count: snapshot.count + 1 };
            case 'DECREMENT':
              return { count: snapshot.count - 1 };
            case 'RESET':
              return { count: 0 };
            default:
              return snapshot;
          }
        }
      }
    }
  );

  // Reactive state from stores
  $: state = $api.state;
  $: connected = $api.connected;
  $: pendingCount = $api.pendingCount;

  // Event handlers
  function increment() {
    api.send({ type: 'INCREMENT' });
  }

  function decrement() {
    api.send({ type: 'DECREMENT' });
  }

  function reset() {
    api.send({ type: 'RESET' });
  }

  function requestSnapshot() {
    api.requestSnapshot();
  }
</script>

<main>
  <h1>🎯 Remote Machine Example</h1>
  
  <div class="card">
    <div>
      <span class="status" class:connected class:disconnected={!connected}>
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </span>
      {#if pendingCount > 0}
        <span class="pending-badge">
          {pendingCount} pending
        </span>
      {/if}
    </div>

    <div class="counter">
      {state?.count ?? '...'}
    </div>

    <div class="button-group">
      <button on:click={decrement} disabled={!connected}>
        ➖ Decrement
      </button>
      <button on:click={reset} disabled={!connected}>
        🔄 Reset
      </button>
      <button on:click={increment} disabled={!connected}>
        ➕ Increment
      </button>
    </div>

    <div style="margin-top: 1em;">
      <button on:click={requestSnapshot} disabled={!connected}>
        📥 Request Fresh Snapshot
      </button>
    </div>
  </div>

  <div class="info-section">
    <h2>How It Works</h2>
    
    <h3>✨ Optimistic Updates</h3>
    <p>
      Click the buttons quickly and watch the counter update immediately.
      The UI is responsive because optimistic updates apply changes locally
      before the server confirms them (500ms delay simulated).
    </p>

    <h3>📊 Pending Events</h3>
    <p>
      The orange badge shows how many events are waiting for server acknowledgment.
      Try clicking multiple times rapidly to see pending events accumulate, then
      watch them clear as the server responds.
    </p>

    <h3>🔄 State Reconciliation</h3>
    <p>
      The server is the source of truth. If the server's state differs from
      optimistic predictions, the UI automatically reconciles when acknowledgments
      arrive. Each event includes a <code>clientSeq</code> for tracking.
    </p>

    <h3>🎯 Use Cases</h3>
    <ul style="text-align: left;">
      <li>VSCode webview extensions (extension host communication)</li>
      <li>Real-time collaborative apps (multiplayer, shared documents)</li>
      <li>Offline-first applications (queue events while offline)</li>
      <li>Client-server state synchronization</li>
    </ul>

    <h3>📦 API Used</h3>
    <pre><code>useRemoteMachinePubSub(pubsub, machineId, {'{'}
  optimistic: {'{'}
    reducer: (snapshot, event) => {'{'}/* ... */{'}'}
  {'}'}
{'}'})</code></pre>

    <h3>🔗 Learn More</h3>
    <p>
      Check out the <a href="https://stately.ai/docs/xstate-svelte" target="_blank">@xstate/svelte documentation</a>
      for more details on remote machines, Svelte 5 runes support, and advanced patterns.
    </p>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    font-size: 3em;
    margin-bottom: 0.5em;
  }

  h2 {
    margin-top: 2em;
    border-bottom: 2px solid #646cff;
    padding-bottom: 0.5em;
  }

  ul {
    line-height: 1.8;
  }

  pre {
    background-color: #1a1a1a;
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    text-align: left;
  }

  code {
    font-family: 'Courier New', monospace;
  }

  a {
    color: #646cff;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
