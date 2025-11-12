---
'@xstate/svelte': minor
---

Add comprehensive test coverage and documentation for @xstate/svelte APIs

**New Tests:**
- Add unit tests for `useActorRef` covering actor creation, event sending, and cleanup
- Add unit tests for `useMachine` covering reactive stores and teardown
- Add comprehensive tests for `useRemoteMachine` including SSR support, optimistic updates, pending event tracking, and connection handling
- Add tests for `useRemoteMachineRunes` (Svelte 5) with rune-based reactive state
- Add tests for `useRemoteMachinePubSub` covering PubSub adapter communication

**Enhanced Documentation:**
- Add comprehensive JSDoc comments to `useActorRef`, `useActor`, `useMachine`, and `useSelector`
- Document generics and type safety features
- Include "When to use" sections for each API
- Add migration notes from XState v4
- Provide detailed code examples in JSDoc

**New Example:**
- Add `svelte-remote-machine` example demonstrating remote machine synchronization
- Showcase optimistic updates, pending event tracking, and connection status
- Include mock server with simulated network delays
- Document real-world use cases (VSCode extensions, collaborative apps, offline-first apps)

This changeset improves developer experience with better test coverage, clearer documentation, and practical examples for using @xstate/svelte in production applications.
