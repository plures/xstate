import { Readable, readable } from 'svelte/store';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  EventFromLogic,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { useActorRef } from './useActorRef.ts';

/**
 * Creates an actor from XState machine logic and provides a reactive Svelte store for state.
 * 
 * This is the primary hook for using XState machines in Svelte applications. It creates
 * an actor, starts it, and returns a reactive store that updates whenever state changes.
 * The actor is automatically cleaned up when the component unmounts.
 * 
 * **When to use:**
 * - You're working with XState machines (the most common use case)
 * - You need reactive state updates in Svelte templates
 * - You want both state access and the ability to send events
 * 
 * **Type Safety:**
 * - `snapshot` - Typed as `Readable<SnapshotFrom<TLogic>>` - a Svelte store
 * - `send` - Typed to accept only valid events for the machine
 * - `actorRef` - Typed as `Actor<TLogic>` for direct actor access
 * 
 * @template TLogic - The type of actor logic
 * @param logic - XState actor logic (typically a machine)
 * @param options - Actor configuration options (context, input, snapshot for rehydration, etc.)
 * @returns Object with `snapshot` (Readable store), `send` (event sender), and `actorRef`
 * 
 * @example
 * ```svelte
 * <script>
 *   import { useActor } from '@xstate/svelte';
 *   import { createMachine } from 'xstate';
 * 
 *   const toggleMachine = createMachine({
 *     initial: 'inactive',
 *     states: {
 *       inactive: { on: { TOGGLE: 'active' } },
 *       active: { on: { TOGGLE: 'inactive' } }
 *     }
 *   });
 * 
 *   const { snapshot, send } = useActor(toggleMachine);
 * </script>
 * 
 * <button on:click={() => send({ type: 'TOGGLE' })}>
 *   {$snapshot.value}
 * </button>
 * ```
 * 
 * @example Rehydration from persisted state
 * ```svelte
 * <script>
 *   const persistedSnapshot = JSON.parse(localStorage.getItem('state'));
 *   const { snapshot, send } = useActor(machine, { 
 *     snapshot: persistedSnapshot 
 *   });
 * </script>
 * ```
 * 
 * @see {@link https://stately.ai/docs/xstate-svelte | @xstate/svelte Documentation}
 */
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: (event: EventFromLogic<TLogic>) => void;
  actorRef: Actor<TLogic>;
} {
  const actorRef = useActorRef(logic, options);

  let currentSnapshot = actorRef.getSnapshot();

  const snapshot = readable(currentSnapshot, (set) => {
    return actorRef.subscribe((nextSnapshot) => {
      if (currentSnapshot !== nextSnapshot) {
        currentSnapshot = nextSnapshot;
        set(currentSnapshot);
      }
    }).unsubscribe;
  });

  return { snapshot, send: actorRef.send, actorRef };
}
