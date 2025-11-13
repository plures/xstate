import { onDestroy } from 'svelte';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  createActor,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';

/**
 * Creates and starts an XState actor from the provided logic.
 * 
 * This hook creates an actor instance, starts it immediately, and automatically
 * stops it when the Svelte component is destroyed. Use this when you need direct
 * access to the actor reference for imperative operations.
 * 
 * **When to use:**
 * - You need to call actor methods directly (e.g., `getSnapshot()`, `subscribe()`)
 * - You're integrating with other systems that expect an actor reference
 * - You want fine-grained control over actor subscriptions
 * 
 * **Migration from v4:**
 * In v4, you might have used `interpret()` and manually managed actor lifecycle.
 * This hook handles lifecycle automatically via Svelte's `onDestroy`.
 * 
 * @template TLogic - The type of actor logic (machine, promise, observable, etc.)
 * @param logic - XState actor logic (machine, promise, observable, transition function, etc.)
 * @param options - Actor configuration options (context, input, inspect, etc.)
 * @returns {Actor<TLogic>} Started actor reference that will be stopped on component unmount
 * 
 * @example
 * ```svelte
 * <script>
 *   import { useActorRef } from '@xstate/svelte';
 *   import { createMachine } from 'xstate';
 * 
 *   const machine = createMachine({
 *     initial: 'idle',
 *     states: { idle: {}, loading: {} }
 *   });
 * 
 *   const actorRef = useActorRef(machine);
 *   
 *   // Direct actor access
 *   const snapshot = actorRef.getSnapshot();
 *   actorRef.send({ type: 'START' });
 * </script>
 * ```
 * 
 * @see {@link https://stately.ai/docs/xstate-svelte | @xstate/svelte Documentation}
 */
export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): Actor<TLogic> {
  const actorRef = createActor(logic, options).start();
  onDestroy(() => actorRef.stop());
  return actorRef;
}
