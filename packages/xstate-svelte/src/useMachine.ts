import {
  ActorOptions,
  AnyStateMachine,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { useActor } from './useActor';

/**
 * Alias for {@link useActor} specifically for XState machines.
 * 
 * This is a convenience function that calls `useActor` internally. Use this
 * when you want to be explicit that you're working with a machine, or for
 * better alignment with XState v4 migration paths.
 * 
 * @template TMachine - The type of state machine
 * @param machine - XState machine definition
 * @param options - Actor configuration options
 * @returns Object with `snapshot` (Readable store), `send`, and `actorRef`
 * 
 * @example
 * ```svelte
 * <script>
 *   import { useMachine } from '@xstate/svelte';
 *   import { createMachine } from 'xstate';
 * 
 *   const machine = createMachine({
 *     initial: 'idle',
 *     states: { idle: {}, loading: {} }
 *   });
 * 
 *   const { snapshot, send } = useMachine(machine);
 * </script>
 * ```
 * 
 * @see {@link useActor} for detailed documentation
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TMachine> & {
        [K in RequiredActorOptionsKeys<TMachine>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
) {
  return useActor(machine, options);
}
