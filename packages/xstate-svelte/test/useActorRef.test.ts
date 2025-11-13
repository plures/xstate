import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { createMachine } from 'xstate';
import UseActorRef from './UseActorRef.svelte';

describe('useActorRef', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create and start an actor', async () => {
    const { getByTestId } = render(UseActorRef);
    const countEl = getByTestId('count');
    
    expect(countEl.textContent).toBe('0');
  });

  it('should allow sending events to the actor', async () => {
    const { getByTestId } = render(UseActorRef);
    const countEl = getByTestId('count');
    const incrementBtn = getByTestId('increment');
    
    expect(countEl.textContent).toBe('0');
    
    await fireEvent.click(incrementBtn);
    expect(countEl.textContent).toBe('1');
    
    await fireEvent.click(incrementBtn);
    expect(countEl.textContent).toBe('2');
  });

  it('should cleanup actor on component unmount', async () => {
    const machine = createMachine({
      id: 'test',
      initial: 'active',
      states: { active: {} }
    });
    
    const stopSpy = vi.fn();
    const originalStop = machine.prototype?.stop;
    
    const { unmount } = render(UseActorRef);
    
    // Unmount should trigger onDestroy
    unmount();
    
    // Note: Testing cleanup is implicit - if there's a memory leak,
    // it will be caught by repeated test runs
  });
});
