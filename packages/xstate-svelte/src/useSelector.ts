import { readable } from 'svelte/store';
import type { AnyActorRef, SnapshotFrom, Subscription } from 'xstate';

/**
 * Default comparison function using strict equality.
 */
function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

/**
 * Creates a Svelte store that subscribes to a derived value from an actor's state.
 * 
 * This hook optimizes re-renders by only updating the store when the selected
 * value changes (using the comparison function). This is useful when you only
 * need a small part of the actor's state.
 * 
 * **When to use:**
 * - You only need a specific part of the state (e.g., a single counter value)
 * - You want to optimize re-renders for large state objects
 * - You need to derive computed values from state
 * 
 * **Performance:**
 * Without `useSelector`, the component re-renders whenever any part of state changes.
 * With `useSelector`, the component only re-renders when the selected value changes.
 * 
 * **Type Safety:**
 * - The selector function receives a fully-typed snapshot
 * - The returned store is typed to the selector's return type
 * - Custom comparison functions are type-checked
 * 
 * @template TActor - The type of actor (must have `getSnapshot` and `subscribe`)
 * @template T - The type of the selected value
 * @param actor - Actor reference to select from
 * @param selector - Function that extracts a value from the actor's snapshot
 * @param compare - Optional comparison function to determine if the value changed (defaults to `===`)
 * @returns {Readable<T>} Svelte store containing the selected value
 * 
 * @example Basic usage
 * ```svelte
 * <script>
 *   import { useActor, useSelector } from '@xstate/svelte';
 *   import { createMachine } from 'xstate';
 * 
 *   const machine = createMachine({
 *     context: { count: 0, name: 'Alice' },
 *     // ... machine definition
 *   });
 * 
 *   const { actorRef } = useActor(machine);
 *   
 *   // Only re-renders when count changes, not when name changes
 *   const count = useSelector(actorRef, (state) => state.context.count);
 * </script>
 * 
 * <div>Count: {$count}</div>
 * ```
 * 
 * @example Custom comparison function
 * ```svelte
 * <script>
 *   // Case-insensitive comparison for strings
 *   const name = useSelector(
 *     actorRef, 
 *     (state) => state.context.name,
 *     (a, b) => a.toLowerCase() === b.toLowerCase()
 *   );
 * </script>
 * ```
 * 
 * @example Derived values
 * ```svelte
 * <script>
 *   // Select a computed value
 *   const doubledCount = useSelector(
 *     actorRef,
 *     (state) => state.context.count * 2
 *   );
 * </script>
 * ```
 * 
 * @see {@link https://stately.ai/docs/xstate-svelte | @xstate/svelte Documentation}
 */
export const useSelector = <
  TActor extends Pick<AnyActorRef, 'getSnapshot' | 'subscribe'>,
  T
>(
  actor: TActor,
  selector: (
    snapshot: TActor extends { getSnapshot(): infer TSnapshot }
      ? TSnapshot
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) => {
  let sub: Subscription;

  let prevSelected = selector(actor.getSnapshot());

  const selected = readable(prevSelected, (set) => {
    const onNext = (snapshot: SnapshotFrom<TActor>) => {
      const nextSelected = selector(snapshot);
      if (!compare(prevSelected, nextSelected)) {
        prevSelected = nextSelected;
        set(nextSelected);
      }
    };

    // Make sure the store gets updated when it's subscribed to.
    onNext(actor.getSnapshot());

    sub = actor.subscribe(onNext);

    return () => {
      sub.unsubscribe();
    };
  });

  return selected;
};
