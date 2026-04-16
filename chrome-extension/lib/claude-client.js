// Claude Client - Streaming API integration with action extraction
// Supports MOCK_MODE for testing without an API key

export const MOCK_API_KEY = 'MOCK_MODE';
export const DEMO_API_KEY = 'DEMO_KEY';
const DEMO_PROXY_URL = 'http://localhost:3456/v1/messages';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeClient {
  constructor() {
    this.model = 'claude-sonnet-4-20250514';
    this.maxTokens = 4096;
    this._abortController = null;
  }

  _getEndpoint(apiKey) {
    return apiKey === DEMO_API_KEY ? DEMO_PROXY_URL : ANTHROPIC_API_URL;
  }

  async validateApiKey(apiKey) {
    if (apiKey === MOCK_API_KEY) return true;
    if (apiKey === DEMO_API_KEY) {
      // Check if demo proxy server is running
      try {
        const response = await fetch(DEMO_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        });
        return response.ok;
      } catch {
        return false;
      }
    }
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async *createMessageStream(apiKey, messages, systemPrompt) {
    if (apiKey === MOCK_API_KEY) {
      yield* this._createMockStream(messages);
      return;
    }

    this._abortController = new AbortController();
    const endpoint = this._getEndpoint(apiKey);
    const isDemo = apiKey === DEMO_API_KEY;

    const headers = { 'Content-Type': 'application/json' };
    if (!isDemo) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages,
        stream: true
      }),
      signal: this._abortController.signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let usage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'content_block_delta' && event.delta?.text) {
              fullText += event.delta.text;
              yield { type: 'text', text: event.delta.text };
            }

            if (event.type === 'message_delta' && event.usage) {
              usage = event.usage;
            }

            if (event.type === 'message_start' && event.message?.usage) {
              usage = { ...usage, ...event.message.usage };
            }
          } catch { /* skip malformed events */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', fullText, usage };
  }

  // ---- Mock Streaming for Testing ----

  async *_createMockStream(messages) {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const mockResponse = this._getMockResponse(lastMsg);

    // Simulate streaming: emit word by word with small delays
    const words = mockResponse.split(' ');
    let fullText = '';

    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      fullText += chunk;
      yield { type: 'text', text: chunk };
      await this._sleep(40 + Math.random() * 40);
    }

    yield {
      type: 'done',
      fullText,
      usage: { input_tokens: 150, output_tokens: fullText.split(' ').length * 2 }
    };
  }

  _getMockResponse(userMessage) {
    const lower = userMessage.toLowerCase();

    // Detect page context in the message
    const hasJobs = lower.includes('"jobs"') || lower.includes('"job_search"');
    const hasJobList = lower.includes('"extractedjobcount"') && !lower.includes('"extractedjobcount": 0');
    const hasModal = lower.includes('"isopen": true') || lower.includes('"isopen":true');
    const hasFormFields = lower.includes('"fields"') && lower.includes('"label"');
    const isOnLinkedIn = lower.includes('linkedin.com');
    const isOnJobSearch = lower.includes('"job_search"') || lower.includes('/jobs/search');
    const isOtherPage = lower.includes('"other"') || lower.includes('"linkedin_other"');

    // ---- Navigation needed ----
    if (!isOnLinkedIn || isOtherPage) {
      if (lower.includes('apply') || lower.includes('job') || lower.includes('search')) {
        return `Navigating to LinkedIn Jobs...\n\n\`\`\`json\n[{"type": "navigate", "url": "https://www.linkedin.com/jobs/search/?keywords=software+engineer&f_AL=true"}]\n\`\`\``;
      }
    }

    // ---- Auto apply / apply to all ----
    if (lower.includes('apply to all') || lower.includes('auto apply') || lower.includes('apply for jobs') || lower.includes('start applying')) {
      if (!isOnJobSearch) {
        return `Navigating to LinkedIn Jobs...\n\n\`\`\`json\n[{"type": "navigate", "url": "https://www.linkedin.com/jobs/search/?keywords=software+engineer&f_AL=true"}]\n\`\`\``;
      }
      return `Scanning jobs...\n\n\`\`\`json\n[{"type": "scan_jobs"}]\n\`\`\``;
    }

    // ---- Scan jobs ----
    if (lower.includes('scan') && lower.includes('job')) {
      if (isOnJobSearch) {
        return `Scanning...\n\n\`\`\`json\n[{"type": "scan_jobs"}]\n\`\`\``;
      }
      return `Navigating to Jobs first...\n\n\`\`\`json\n[{"type": "navigate", "url": "https://www.linkedin.com/jobs/search/?keywords=software+engineer&f_AL=true"}]\n\`\`\``;
    }

    // ---- Apply to current job ----
    if (lower.includes('apply') && (lower.includes('current') || lower.includes('selected') || lower.includes('this job'))) {
      if (hasModal && hasFormFields) {
        return `Filling form...\n\n\`\`\`json\n[{"type": "fill_form", "fields": {"First name": "John", "Last name": "Doe", "Email": "john@example.com", "Phone": "+1234567890"}}]\n\`\`\``;
      }
      return `Clicking Easy Apply...\n\n\`\`\`json\n[{"type": "click_apply"}]\n\`\`\``;
    }

    // ---- Action results - auto-continue ----
    if (lower.includes('[action result') && lower.includes('fill_form')) {
      return `Proceeding...\n\n\`\`\`json\n[{"type": "next_step"}]\n\`\`\``;
    }

    if (lower.includes('form fields available') || lower.includes('here are the form fields') || (lower.includes('form') && hasFormFields)) {
      return `Filling form...\n\n\`\`\`json\n[{"type": "fill_form", "fields": {"First name": "John", "Last name": "Doe", "Email": "john@example.com", "Phone": "+1234567890", "City": "San Francisco"}}]\n\`\`\``;
    }

    if (lower.includes('easy apply clicked') || lower.includes('[action result: click_apply]')) {
      return `Scanning form...\n\n\`\`\`json\n[{"type": "scan_form"}]\n\`\`\``;
    }

    if (lower.includes('form filled') || lower.includes('[action result: fill_form]')) {
      return `Next step...\n\n\`\`\`json\n[{"type": "next_step"}]\n\`\`\``;
    }

    if (lower.includes('submitted') || lower.includes('move to the next job')) {
      return `Moving to next job...\n\n\`\`\`json\n[{"type": "click_job", "index": 0}]\n\`\`\``;
    }

    if (lower.includes('page loaded') || lower.includes('[action result: navigate]') || lower.includes('navigated')) {
      return `Scanning jobs...\n\n\`\`\`json\n[{"type": "scan_jobs"}]\n\`\`\``;
    }

    if (lower.includes('scan_form') || lower.includes('[action result: scan_form]')) {
      return `Filling form...\n\n\`\`\`json\n[{"type": "fill_form", "fields": {"First name": "John", "Last name": "Doe", "Email": "john@example.com"}}]\n\`\`\``;
    }

    if (lower.includes('found') && lower.includes('jobs') && lower.includes('start applying')) {
      return `Starting applications. Clicking first Easy Apply job...\n\n\`\`\`json\n[{"type": "click_job", "index": 0}]\n\`\`\``;
    }

    if (lower.includes('[action result: scan_jobs]') || lower.includes('scan_jobs')) {
      return `Found jobs. Starting to apply...\n\n\`\`\`json\n[{"type": "click_job", "index": 0}]\n\`\`\``;
    }

    if (lower.includes('[action result: click_job]') || lower.includes('continue with the workflow')) {
      return `Clicking Easy Apply...\n\n\`\`\`json\n[{"type": "click_apply"}]\n\`\`\``;
    }

    if (lower.includes('stepped forward') || lower.includes('[action result: next_step]')) {
      if (hasFormFields) {
        return `More fields. Filling...\n\n\`\`\`json\n[{"type": "fill_form", "fields": {"City": "San Francisco", "Years of experience": "5"}}]\n\`\`\``;
      }
      return `Continuing...\n\n\`\`\`json\n[{"type": "next_step"}]\n\`\`\``;
    }

    // ---- Stats ----
    if (lower.includes('stat') || lower.includes('usage') || lower.includes('history')) {
      return `**Session Stats (Mock Mode)**\n\n- Applications sent: 0\n- Mode: **Mock / Testing**\n\nUse a real API key for live operation.`;
    }

    // ---- Help ----
    if (lower.includes('help') || lower.includes('what can you do')) {
      return `Commands:\n- **"Apply to all jobs"** - auto-apply to Easy Apply jobs\n- **"Search for [role] jobs"** - navigate and apply\n- **"Apply to current job"** - apply to selected listing\n- **"My stats"** - show statistics\n\nMock mode active. Add API key for live operation.`;
    }

    // ---- Default: try to be useful ----
    if (isOnJobSearch) {
      return `Scanning jobs on this page...\n\n\`\`\`json\n[{"type": "scan_jobs"}]\n\`\`\``;
    }

    return `Navigating to LinkedIn Jobs...\n\n\`\`\`json\n[{"type": "navigate", "url": "https://www.linkedin.com/jobs/search/?keywords=software+engineer&f_AL=true"}]\n\`\`\``;
  }

  abort() {
    this._abortController?.abort();
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Extract action blocks from Claude's response
  static extractActions(text) {
    const actions = [];

    // Pattern 1: ```json code blocks
    const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/g;
    let match;
    while ((match = jsonBlockRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.type) actions.push(item);
          }
        } else if (parsed.type) {
          actions.push(parsed);
        }
      } catch { /* skip */ }
    }

    // Pattern 2: <action>...</action> tags
    const actionTagRegex = /<action>([\s\S]*?)<\/action>/g;
    while ((match = actionTagRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.type) actions.push(item);
          }
        } else if (parsed.type) {
          actions.push(parsed);
        }
      } catch { /* skip */ }
    }

    // Validate actions
    return actions.filter(a => VALID_ACTION_TYPES.includes(a.type));
  }
}

const VALID_ACTION_TYPES = [
  'click', 'type', 'select', 'scroll', 'wait',
  'scan_jobs', 'scan_form', 'fill_form',
  'click_job', 'click_apply', 'next_step', 'dismiss_modal',
  'upload_resume', 'debug_dom', 'navigate'
];
