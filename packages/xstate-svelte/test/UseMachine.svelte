<script lang="ts">
  import { useMachine } from '../src/index.ts';
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

<div>
  <div data-testid="state">{$snapshot.value}</div>
  <button data-testid="toggle" on:click={() => send({ type: 'TOGGLE' })}>
    Toggle
  </button>
</div>
