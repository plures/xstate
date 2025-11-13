<script lang="ts">
  import { useActorRef } from '../src/index.ts';
  import { createMachine } from 'xstate';

  const counterMachine = createMachine({
    id: 'counter',
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          INCREMENT: {
            actions: ({ context }) => context.count++
          }
        }
      }
    }
  });

  const actorRef = useActorRef(counterMachine);
  
  // Get initial snapshot
  let count = $state(actorRef.getSnapshot().context.count);
  
  // Subscribe to changes
  actorRef.subscribe((snapshot) => {
    count = snapshot.context.count;
  });

  function increment() {
    actorRef.send({ type: 'INCREMENT' });
  }
</script>

<div>
  <div data-testid="count">{count}</div>
  <button data-testid="increment" on:click={increment}>Increment</button>
</div>
