/**
 * Webview-side PubSub adapter using acquireVsCodeApi().postMessage
 * or window.postMessage fallback.
 * 
 * This adapter allows webview components to communicate with the extension host
 * via the VS Code webview API or a fallback mechanism for development/testing.
 */

/**
 * Message handler type
 */
type MessageHandler<T = any> = (data: T) => void;

/**
 * VS Code API type (simplified)
 */
interface VsCodeApi {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

/**
 * Declare global acquireVsCodeApi if available
 */
declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

/**
 * PubSub message structure
 */
interface PubSubMessage {
  type: 'publish' | 'subscribe';
  topic: string;
  data?: any;
}

/**
 * Webview PubSub adapter implementation
 */
export class WebviewPubSubAdapter {
  private vscodeApi: VsCodeApi | null = null;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private useFallback: boolean = false;

  constructor() {
    // Try to acquire VS Code API
    if (typeof window !== 'undefined' && window.acquireVsCodeApi) {
      try {
        this.vscodeApi = window.acquireVsCodeApi();
      } catch (e) {
        console.warn('Failed to acquire VS Code API, using fallback', e);
        this.useFallback = true;
      }
    } else {
      this.useFallback = true;
    }

    // Setup message listener
    this.setupMessageListener();
  }

  /**
   * Setup listener for incoming messages
   */
  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      const message = event.data as PubSubMessage;
      
      if (message && message.type === 'publish') {
        // Handle incoming publish from extension host
        const handlers = this.subscriptions.get(message.topic);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message.data);
            } catch (e) {
              console.error(`Error in subscription handler for topic ${message.topic}:`, e);
            }
          });
        }
      }
    });
  }

  /**
   * Subscribe to a topic
   * @param topic - Topic to subscribe to
   * @param handler - Handler function for messages
   * @returns Unsubscribe function
   */
  subscribe<T = any>(topic: string, handler: MessageHandler<T>): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(handler as MessageHandler);

    // Notify extension host of subscription (optional, for awareness)
    // Not strictly necessary with retained snapshots

    return () => {
      const handlers = this.subscriptions.get(topic);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
        if (handlers.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    };
  }

  /**
   * Publish data to a topic
   * @param topic - Topic to publish to
   * @param data - Data to publish
   */
  publish<T = any>(topic: string, data: T): void {
    const message: PubSubMessage = {
      type: 'publish',
      topic,
      data
    };

    if (this.vscodeApi && !this.useFallback) {
      // Use VS Code API
      this.vscodeApi.postMessage(message);
    } else {
      // Fallback to window.postMessage for development
      // In real scenario, this would need a proper target
      if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage(message, '*');
      } else {
        console.warn('No postMessage target available', message);
      }
    }
  }

  /**
   * Check if using fallback mode
   */
  isFallbackMode(): boolean {
    return this.useFallback;
  }
}

/**
 * Create a webview PubSub adapter instance
 */
export function createWebviewPubSubAdapter(): WebviewPubSubAdapter {
  return new WebviewPubSubAdapter();
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { createWebviewPubSubAdapter } from './webview-pubsub-adapter';
 * 
 * const adapter = createWebviewPubSubAdapter();
 * 
 * // Subscribe to snapshots
 * adapter.subscribe('machine:app:snapshot', (snapshot) => {
 *   console.log('Received snapshot:', snapshot);
 * });
 * 
 * // Publish an event
 * adapter.publish('machine:app:events', {
 *   event: { type: 'click', sender: 'button1' },
 *   clientSeq: 1
 * });
 * ```
 */
