// Message Router - Type-safe IPC between extension components

export const MessageTypes = {
  // Chat
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  STREAM_CHUNK: 'STREAM_CHUNK',
  STREAM_COMPLETE: 'STREAM_COMPLETE',
  STREAM_ERROR: 'STREAM_ERROR',

  // Page context
  GET_PAGE_CONTEXT: 'GET_PAGE_CONTEXT',
  PAGE_CONTEXT_RESPONSE: 'PAGE_CONTEXT_RESPONSE',

  // Actions
  EXECUTE_ACTION: 'EXECUTE_ACTION',
  ACTION_RESULT: 'ACTION_RESULT',
  CONFIRM_ACTION: 'CONFIRM_ACTION',
  SKIP_ACTION: 'SKIP_ACTION',

  // Settings
  SET_API_KEY: 'SET_API_KEY',
  GET_API_KEY_STATUS: 'GET_API_KEY_STATUS',
  API_KEY_STATUS: 'API_KEY_STATUS',
  SAVE_PROFILE: 'SAVE_PROFILE',

  // Control
  STOP_EXECUTION: 'STOP_EXECUTION',
  OPEN_SIDEBAR: 'OPEN_SIDEBAR',

  // Resume
  ANALYZE_RESUME: 'ANALYZE_RESUME',

  // State
  STATE_UPDATE: 'STATE_UPDATE'
};

export class MessageRouter {
  constructor() {
    this._handlers = new Map();
  }

  on(type, handler) {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, []);
    }
    this._handlers.get(type).push(handler);
    return () => {
      const handlers = this._handlers.get(type);
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  async handle(message, sender) {
    const handlers = this._handlers.get(message.type) || [];
    for (const handler of handlers) {
      const result = await handler(message, sender);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  // Send to background from sidebar/popup
  static async sendToBackground(type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Send to a specific tab's content script
  static async sendToTab(tabId, type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Send to active tab's content script
  static async sendToActiveTab(type, data = {}) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    return MessageRouter.sendToTab(tab.id, type, data);
  }

  // Broadcast to all extension pages (sidebar, popup)
  static broadcast(type, data = {}) {
    chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
  }
}
