import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { createMachine } from 'xstate';
import UseMachine from './UseMachine.svelte';

describe('useMachine', () => {
  afterEach(() => {
    cleanup();
  });

  it('should work with a machine', async () => {
    const { getByTestId } = render(UseMachine);
    const stateEl = getByTestId('state');
    const toggleBtn = getByTestId('toggle');
    
    expect(stateEl.textContent).toBe('inactive');
    
    await fireEvent.click(toggleBtn);
    expect(stateEl.textContent).toBe('active');
    
    await fireEvent.click(toggleBtn);
    expect(stateEl.textContent).toBe('inactive');
  });

  it('should provide a reactive snapshot store', async () => {
    const { getByTestId } = render(UseMachine);
    const stateEl = getByTestId('state');
    
    // Initial state
    expect(stateEl.textContent).toBe('inactive');
    
    // Store should be reactive
    const toggleBtn = getByTestId('toggle');
    await fireEvent.click(toggleBtn);
    
    // State should update reactively
    expect(stateEl.textContent).toBe('active');
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = render(UseMachine);
    
    // Unmount should trigger cleanup
    unmount();
    
    // If there are no errors, cleanup worked correctly
  });
});
