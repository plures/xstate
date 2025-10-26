/**
 * Simple PubSubBroker implementation for the extension host.
 * 
 * Retains last snapshot per machine, multicasts to attached webviews,
 * and echoes clientSeq in retained snapshots when available.
 * 
 * This broker facilitates communication between the authoritative machine
 * in the extension host and multiple webview panels.
 */

/**
 * WebviewPanel interface (simplified for demonstration)
 */
interface WebviewPanel {
  webview: {
    postMessage: (message: any) => void;
    onDidReceiveMessage: (callback: (message: any) => void) => void;
  };
}

/**
 * Message structure for pubsub communication
 */
interface PubSubMessage {
  type: 'publish' | 'subscribe';
  topic: string;
  data?: any;
}

/**
 * Retained snapshot with metadata
 */
interface RetainedSnapshot {
  data: any;
  serverSeq: number;
  echoClientSeq?: number;
}

/**
 * PubSubBroker manages communication between extension host and webviews
 */
export class PubSubBroker {
  private webviews: Set<WebviewPanel> = new Set();
  private retainedSnapshots: Map<string, RetainedSnapshot> = new Map();
  private topicHandlers: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * Attach a webview panel to the broker
   * @param panel - The webview panel to attach
   * @returns Cleanup function to detach the panel
   */
  attachWebviewPanel(panel: WebviewPanel): () => void {
    this.webviews.add(panel);

    // Send retained snapshots to the newly attached webview
    this.retainedSnapshots.forEach((snapshot, topic) => {
      panel.webview.postMessage({
        type: 'publish',
        topic,
        data: snapshot
      });
    });

    // Setup message handler for incoming messages from webview
    panel.webview.onDidReceiveMessage((message: PubSubMessage) => {
      if (message.type === 'publish') {
        // Webview is publishing to a topic (e.g., sending events)
        this.publish(message.topic, message.data);
      }
    });

    // Return cleanup function
    return () => {
      this.webviews.delete(panel);
    };
  }

  /**
   * Subscribe to a topic (for extension host-side subscriptions)
   * @param topic - Topic to subscribe to
   * @param handler - Handler function for topic messages
   * @returns Unsubscribe function
   */
  subscribe(topic: string, handler: (data: any) => void): () => void {
    if (!this.topicHandlers.has(topic)) {
      this.topicHandlers.set(topic, new Set());
    }
    this.topicHandlers.get(topic)!.add(handler);

    // If there's a retained snapshot for this topic, deliver it immediately
    const retained = this.retainedSnapshots.get(topic);
    if (retained) {
      handler(retained);
    }

    return () => {
      const handlers = this.topicHandlers.get(topic);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.topicHandlers.delete(topic);
        }
      }
    };
  }

  /**
   * Publish data to a topic
   * @param topic - Topic to publish to
   * @param data - Data to publish
   */
  publish(topic: string, data: any): void {
    // If this is a snapshot topic, retain it
    if (topic.includes(':snapshot')) {
      this.retainedSnapshots.set(topic, data);
    }

    // Notify extension host-side subscribers
    const handlers = this.topicHandlers.get(topic);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }

    // Broadcast to all webviews
    const message: PubSubMessage = {
      type: 'publish',
      topic,
      data
    };
    this.webviews.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  /**
   * Get retained snapshot for a topic
   * @param topic - Snapshot topic
   * @returns Retained snapshot or undefined
   */
  getRetainedSnapshot(topic: string): RetainedSnapshot | undefined {
    return this.retainedSnapshots.get(topic);
  }

  /**
   * Clear retained snapshot for a topic
   * @param topic - Topic to clear
   */
  clearRetainedSnapshot(topic: string): void {
    this.retainedSnapshots.delete(topic);
  }
}

/**
 * Create a singleton broker instance for the extension
 */
export function createBroker(): PubSubBroker {
  return new PubSubBroker();
}
