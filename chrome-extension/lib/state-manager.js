// State Manager - Centralized reactive state with persistence

export class StateManager {
  constructor() {
    this._state = {
      extension: {
        apiKeyConfigured: false,
        apiKeyValid: false
      },
      conversation: {
        messages: [],
        isStreaming: false,
        currentStreamId: null
      },
      pageContext: {
        url: '',
        pageType: 'unknown',
        jobs: [],
        modal: null,
        selectedJob: null
      },
      actions: {
        pending: [],
        completed: [],
        failed: []
      },
      profile: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        experience: '',
        resumeSummary: ''
      },
      stats: {
        applied: 0,
        skipped: 0,
        failed: 0,
        sessionStart: null
      }
    };
    this._subscribers = new Map();
    this._loadPersisted();
  }

  getState(path) {
    if (!path) return this._state;
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }

  setState(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const parent = keys.reduce((obj, key) => {
      if (obj[key] === undefined) obj[key] = {};
      return obj[key];
    }, this._state);
    parent[lastKey] = value;
    this._notify(path, value);
    this._persistIfNeeded(path);
  }

  subscribe(path, callback) {
    if (!this._subscribers.has(path)) {
      this._subscribers.set(path, []);
    }
    this._subscribers.get(path).push(callback);
    return () => {
      const subs = this._subscribers.get(path);
      const idx = subs.indexOf(callback);
      if (idx !== -1) subs.splice(idx, 1);
    };
  }

  _notify(changedPath, value) {
    for (const [path, callbacks] of this._subscribers) {
      if (changedPath.startsWith(path) || path.startsWith(changedPath)) {
        callbacks.forEach(cb => cb(value, changedPath));
      }
    }
  }

  // Persist critical state
  _persistIfNeeded(path) {
    const persistPaths = ['profile', 'extension', 'stats'];
    if (persistPaths.some(p => path.startsWith(p))) {
      const toSave = {};
      for (const p of persistPaths) {
        toSave[`state_${p}`] = this._state[p];
      }
      // Keep last 50 messages
      toSave.state_messages = (this._state.conversation.messages || []).slice(-50);
      chrome.storage.local.set(toSave);
    }
  }

  async _loadPersisted() {
    const result = await chrome.storage.local.get([
      'state_profile', 'state_extension', 'state_stats', 'state_messages'
    ]);
    if (result.state_profile) this._state.profile = result.state_profile;
    if (result.state_extension) this._state.extension = result.state_extension;
    if (result.state_stats) this._state.stats = result.state_stats;
    if (result.state_messages) this._state.conversation.messages = result.state_messages;
  }

  addMessage(role, content) {
    this._state.conversation.messages.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role,
      content,
      timestamp: Date.now()
    });
    this._notify('conversation.messages', this._state.conversation.messages);
    // Persist messages
    chrome.storage.local.set({
      state_messages: this._state.conversation.messages.slice(-50)
    });
  }

  addAction(action) {
    const actionWithId = {
      ...action,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      status: 'pending'
    };
    this._state.actions.pending.push(actionWithId);
    this._notify('actions.pending', this._state.actions.pending);
    return actionWithId;
  }

  completeAction(actionId, result) {
    const idx = this._state.actions.pending.findIndex(a => a.id === actionId);
    if (idx !== -1) {
      const [action] = this._state.actions.pending.splice(idx, 1);
      action.status = 'completed';
      action.result = result;
      this._state.actions.completed.push(action);
      this._notify('actions', this._state.actions);
    }
  }

  failAction(actionId, error) {
    const idx = this._state.actions.pending.findIndex(a => a.id === actionId);
    if (idx !== -1) {
      const [action] = this._state.actions.pending.splice(idx, 1);
      action.status = 'failed';
      action.error = error;
      this._state.actions.failed.push(action);
      this._notify('actions', this._state.actions);
    }
  }
}
