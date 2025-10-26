/**
 * Example authoritative application machine for the extension host.
 * 
 * This machine stores button labels in context and wires into the PubSubBroker:
 * - Publishes snapshots to machine:{id}:snapshot
 * - Subscribes to machine:{id}:events
 * - Echoes clientSeq on snapshots when available
 */

import { createMachine, createActor, type Actor, type SnapshotFrom } from 'xstate';
import type { PubSubBroker } from './pubsub-broker';

/**
 * Button configuration in machine context
 */
interface ButtonConfig {
  label: {
    value: string;
  };
}

/**
 * Machine context
 */
interface MachineContext {
  buttons: {
    [buttonId: string]: ButtonConfig;
  };
  clickCount: number;
}

/**
 * Machine events
 */
type MachineEvent =
  | { type: 'click'; sender: string }
  | { type: 'updateLabel'; buttonId: string; label: string }
  | { type: 'reset' };

/**
 * Create the application machine
 */
function createAppMachine() {
  return createMachine({
    id: 'appMachine',
    initial: 'idle',
    context: {
      buttons: {
        'button1': { label: { value: 'Click Me' } },
        'button2': { label: { value: 'Press Here' } }
      },
      clickCount: 0
    } as MachineContext,
    states: {
      idle: {
        on: {
          click: {
            actions: [
              {
                type: 'incrementClickCount',
                params: ({ event }) => ({ sender: event.sender })
              }
            ]
          },
          updateLabel: {
            actions: [
              {
                type: 'updateButtonLabel',
                params: ({ event }) => ({
                  buttonId: event.buttonId,
                  label: event.label
                })
              }
            ]
          },
          reset: {
            actions: ['resetClickCount']
          }
        }
      }
    }
  }, {
    actions: {
      incrementClickCount: ({ context, event }: any) => {
        context.clickCount += 1;
        const sender = event.sender || 'unknown';
        const button = context.buttons[sender];
        if (button) {
          console.log(`Button ${sender} clicked! Total clicks: ${context.clickCount}`);
        }
      },
      updateButtonLabel: ({ context, event }: any) => {
        const { buttonId, label } = event;
        if (context.buttons[buttonId]) {
          context.buttons[buttonId].label.value = label;
          console.log(`Button ${buttonId} label updated to: ${label}`);
        }
      },
      resetClickCount: ({ context }: any) => {
        context.clickCount = 0;
        console.log('Click count reset');
      }
    }
  });
}

/**
 * Snapshot with sequence numbers for synchronization
 */
interface RemoteSnapshot<T> {
  snapshot: T;
  serverSeq: number;
  echoClientSeq?: number;
}

/**
 * Event with client sequence
 */
interface EventWithSeq<TEvent> {
  event: TEvent;
  clientSeq: number;
}

/**
 * Wire the machine to the PubSubBroker
 * @param broker - PubSub broker instance
 * @param machineId - Unique machine identifier
 * @returns Actor instance
 */
export function wireAppMachineToBroker(
  broker: PubSubBroker,
  machineId: string = 'app'
): Actor<ReturnType<typeof createAppMachine>> {
  const machine = createAppMachine();
  const actor = createActor(machine);

  let serverSeqCounter = 0;
  let lastClientSeq: number | undefined;

  const snapshotTopic = `machine:${machineId}:snapshot`;
  const eventsTopic = `machine:${machineId}:events`;
  const requestTopic = `machine:${machineId}:request-snapshot`;

  // Publish snapshot with serverSeq and optional echoClientSeq
  const publishSnapshot = (snapshot: SnapshotFrom<typeof actor>, echoClientSeq?: number) => {
    const remoteSnapshot: RemoteSnapshot<SnapshotFrom<typeof actor>> = {
      snapshot,
      serverSeq: ++serverSeqCounter,
      echoClientSeq
    };
    broker.publish(snapshotTopic, remoteSnapshot);
  };

  // Subscribe to events from webviews
  broker.subscribe(eventsTopic, (data: EventWithSeq<MachineEvent>) => {
    const { event, clientSeq } = data;
    lastClientSeq = clientSeq;
    
    console.log(`Received event from webview:`, event, `(clientSeq: ${clientSeq})`);
    
    // Send event to actor
    actor.send(event);
    
    // Publish updated snapshot with echoClientSeq
    publishSnapshot(actor.getSnapshot(), clientSeq);
  });

  // Subscribe to snapshot requests
  broker.subscribe(requestTopic, () => {
    console.log('Snapshot requested');
    publishSnapshot(actor.getSnapshot(), lastClientSeq);
  });

  // Start actor and publish initial snapshot
  actor.start();
  publishSnapshot(actor.getSnapshot());

  // Subscribe to actor state changes for reactive updates
  actor.subscribe((snapshot) => {
    // Only publish if not already published by event handler
    // (to avoid duplicate publications)
    // In practice, you might want more sophisticated logic here
  });

  return actor;
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { createBroker } from './pubsub-broker';
 * import { wireAppMachineToBroker } from './app-machine';
 * 
 * const broker = createBroker();
 * const actor = wireAppMachineToBroker(broker, 'myApp');
 * 
 * // Attach webview panels
 * broker.attachWebviewPanel(panel1);
 * broker.attachWebviewPanel(panel2);
 * ```
 */
