// ApplyPie Sidebar - Main CUA chat interface with streaming and action cards

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const terminateBtn = document.getElementById('terminateBtn');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const connectionStatus = document.getElementById('connectionStatus');
const progressBanner = document.getElementById('progressBanner');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const progressTerminate = document.getElementById('progressTerminate');

let isStreaming = false;
let currentStreamEl = null;
let sessionStats = { applied: 0, total: 0 };

// ---- Event Listeners ----

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_EXECUTION' });
  setStatus('connected', 'Stopped');
  stopBtn.style.display = 'none';
  terminateBtn.style.display = 'none';
  hideProgress();
  if (currentStreamEl) {
    currentStreamEl.querySelector('.streaming-cursor')?.remove();
    currentStreamEl = null;
  }
  isStreaming = false;
  sendBtn.disabled = false;
});

// Terminate - full stop + session reset
terminateBtn.addEventListener('click', terminateAll);
progressTerminate.addEventListener('click', terminateAll);

function terminateAll() {
  chrome.runtime.sendMessage({ type: 'STOP_EXECUTION' });
  chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
  setStatus('connected', 'Terminated');
  stopBtn.style.display = 'none';
  terminateBtn.style.display = 'none';
  hideProgress();
  if (currentStreamEl) {
    currentStreamEl.querySelector('.streaming-cursor')?.remove();
    currentStreamEl = null;
  }
  isStreaming = false;
  sendBtn.disabled = false;
  sessionStats = { applied: 0, total: 0 };
  addLog('All operations terminated and session reset', 'error');
}

clearBtn.addEventListener('click', () => {
  messagesEl.innerHTML = '';
  addMessage('assistant', '<p>Chat cleared. What would you like to do?</p>', true);
});

document.querySelectorAll('.action-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (isStreaming) return;
    const cmd = chip.dataset.command;

    // Intercept Stats command to show local session log
    if (cmd.toLowerCase().includes('stats')) {
      showSessionLog();
      return;
    }

    inputEl.value = cmd;
    handleSend();
  });
});

// ---- Message Handling ----

function handleSend() {
  const text = inputEl.value.trim();
  if (!text || isStreaming) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  addMessage('user', escapeHtml(text));

  isStreaming = true;
  sendBtn.disabled = true;
  stopBtn.style.display = '';
  terminateBtn.style.display = '';
  setStatus('working', 'Thinking...');

  const lower = text.toLowerCase();
  if (lower.includes('apply') || lower.includes('auto') || lower.includes('start')) {
    showProgress('Starting job applications...');
  }

  currentStreamEl = addMessage('assistant', '<span class="streaming-cursor"></span>', true);

  chrome.runtime.sendMessage({
    type: 'CHAT_MESSAGE',
    text,
    autoExecute: lower.includes('auto') || lower.includes('apply to all')
  });
}

// ---- Listen for messages from background ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STREAM_CHUNK':
      handleStreamChunk(message.text);
      break;
    case 'STREAM_COMPLETE':
      handleStreamComplete(message);
      break;
    case 'STREAM_ERROR':
      handleStreamError(message.error);
      break;
    case 'ACTION_RESULT':
      handleActionResult(message.actionId, message.result);
      break;
    case 'ASK_USER':
      showQuestion(message);
      break;
    case 'STATE_UPDATE':
      break;
  }
  return false;
});

function handleStreamChunk(text) {
  if (!currentStreamEl) {
    currentStreamEl = addMessage('assistant', '', true);
  }
  const content = currentStreamEl.querySelector('.msg-content');
  const cursor = content.querySelector('.streaming-cursor');
  if (cursor) cursor.remove();

  const span = document.createElement('span');
  span.innerHTML = formatText(text);
  content.appendChild(span);

  const newCursor = document.createElement('span');
  newCursor.className = 'streaming-cursor';
  content.appendChild(newCursor);

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function handleStreamComplete(data) {
  isStreaming = false;
  sendBtn.disabled = false;
  stopBtn.style.display = 'none';

  if (currentStreamEl) {
    const cursor = currentStreamEl.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
    const content = currentStreamEl.querySelector('.msg-content');
    content.innerHTML = formatMarkdown(data.fullText || content.textContent);
    currentStreamEl = null;
  }

  // Track progress from response text
  const applyMatch = (data.fullText || '').match(/(\d+)\/(\d+)/);
  if (applyMatch) {
    sessionStats.applied = parseInt(applyMatch[1]);
    sessionStats.total = parseInt(applyMatch[2]);
    updateProgress();
  }

  if (data.actions?.length > 0) {
    let hasManualActions = false;
    for (const action of data.actions) {
      if (action.autoExecuted) continue;
      if (!action.id) {
        action.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      }
      showActionCard(action);
      hasManualActions = true;
    }
    if (!hasManualActions && data.actions.some(a => a.autoExecuted)) {
      terminateBtn.style.display = '';
    }
  }

  setStatus('connected', 'Ready');

  if (data.usage) {
    addLog(`Tokens: ${data.usage.input_tokens || 0} in / ${data.usage.output_tokens || 0} out`, 'info');
  }
}

function handleStreamError(error) {
  isStreaming = false;
  sendBtn.disabled = false;
  stopBtn.style.display = 'none';

  if (currentStreamEl) {
    currentStreamEl.querySelector('.streaming-cursor')?.remove();
    currentStreamEl = null;
  }

  addMessage('error', escapeHtml(error));
  setStatus('disconnected', 'Error');
}

function handleActionResult(actionId, result) {
  const card = document.querySelector(`[data-action-id="${actionId}"]`);
  if (card) {
    if (result?.ok) {
      card.classList.add('completed');
      card.querySelector('.action-card-type').textContent += ' - Done';
      card.querySelector('.action-card-buttons')?.remove();
    } else {
      card.classList.add('failed');
      card.querySelector('.action-card-type').textContent += ' - Failed';
      card.querySelector('.action-card-buttons')?.remove();
      if (result?.error) {
        const err = document.createElement('div');
        err.className = 'log-entry error';
        err.textContent = result.error;
        card.appendChild(err);
      }
    }
  }

  if (result?.data?.submitted || result?.submitted) {
    sessionStats.applied++;
    updateProgress();
  }

  if (result?.data?.jobs) {
    showJobsList(result.data.jobs);
  }
}

// ---- Progress Banner ----

function showProgress(text) {
  progressBanner.style.display = '';
  progressText.textContent = text;
  progressFill.style.width = '0%';
}

function hideProgress() {
  progressBanner.style.display = 'none';
}

function updateProgress() {
  if (sessionStats.total > 0) {
    const pct = Math.round((sessionStats.applied / sessionStats.total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `Applied ${sessionStats.applied}/${sessionStats.total} jobs`;
    progressBanner.style.display = '';
  }
}

// ---- Action Cards ----

function showActionCard(action) {
  const card = document.createElement('div');
  card.className = 'action-card';
  card.dataset.actionId = action.id;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `Action: ${action.type.replace(/_/g, ' ')}`);

  const iconClass = getActionIconClass(action.type);
  const emoji = getActionEmoji(action.type);
  const desc = getActionDescription(action);

  card.innerHTML = `
    <div class="action-card-header">
      <div class="action-card-icon ${iconClass}" aria-hidden="true">${emoji}</div>
      <div>
        <div class="action-card-type">${action.type.replace(/_/g, ' ')}</div>
        <div class="action-card-desc">${escapeHtml(desc)}</div>
      </div>
    </div>
    <div class="action-card-buttons">
      <button class="action-btn execute" data-id="${action.id}" aria-label="Execute ${action.type}">Execute</button>
      <button class="action-btn skip" data-id="${action.id}" aria-label="Skip ${action.type}">Skip</button>
    </div>
  `;

  card.querySelector('.action-btn.execute').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CONFIRM_ACTION', actionId: action.id });
    card.querySelector('.action-card-buttons')?.remove();
    setStatus('working', `Executing ${action.type}...`);
  });

  card.querySelector('.action-btn.skip').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SKIP_ACTION', actionId: action.id });
    card.classList.add('failed');
    card.querySelector('.action-card-type').textContent += ' - Skipped';
    card.querySelector('.action-card-buttons')?.remove();
  });

  messagesEl.appendChild(card);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function getActionIconClass(type) {
  if (['scan_jobs', 'scan_form'].includes(type)) return 'scan';
  if (['click_apply', 'next_step', 'fill_form'].includes(type)) return 'apply';
  if (['type', 'select'].includes(type)) return 'form';
  return 'nav';
}

function getActionEmoji(type) {
  const map = {
    scan_jobs: '\u{1F50D}', scan_form: '\u{1F4CB}', click_job: '\u{1F446}', click_apply: '\u2705',
    fill_form: '\u{1F4DD}', next_step: '\u27A1\uFE0F', dismiss_modal: '\u274C', type: '\u2328\uFE0F',
    select: '\u{1F4CC}', scroll: '\u{1F4DC}', wait: '\u23F3', click: '\u{1F446}'
  };
  return map[type] || '\u{1F527}';
}

function getActionDescription(action) {
  switch (action.type) {
    case 'click_job': return `Click job #${action.index ?? action.linkedinId ?? '?'}`;
    case 'click_apply': return 'Open Easy Apply form';
    case 'fill_form': return `Fill ${Object.keys(action.fields || {}).length} field(s)`;
    case 'next_step': return 'Advance to next form step';
    case 'scan_jobs': return 'Scan visible job listings';
    case 'scan_form': return 'Read form fields';
    case 'dismiss_modal': return 'Close current dialog';
    case 'type': return `Type "${(action.value || '').slice(0, 30)}..."`;
    case 'select': return `Select "${action.value}"`;
    case 'wait': return `Wait ${action.ms}ms`;
    default: return action.selector || '';
  }
}

function showJobsList(jobs) {
  if (!jobs?.length) return;

  let html = `<p>Found <strong>${jobs.length}</strong> jobs:</p>`;
  const easyApplyCount = jobs.filter(j => j.easyApply).length;
  html += `<p style="font-size:11px;color:var(--text-muted)">${easyApplyCount} with Easy Apply</p>`;

  for (const job of jobs.slice(0, 25)) {
    html += `<div class="job-card-msg">
      <div class="job-title">${escapeHtml(job.title)}</div>
      <div class="job-company">${escapeHtml(job.company)}</div>
      <div class="job-meta">${escapeHtml(job.location)}${job.salary ? ' &middot; ' + escapeHtml(job.salary) : ''}</div>
      <span class="job-badge ${job.easyApply ? 'easy' : 'external'}">${job.easyApply ? 'Easy Apply' : 'External'}</span>
    </div>`;
  }

  if (jobs.length > 25) {
    html += `<p style="font-size:11px;color:var(--text-muted)">...and ${jobs.length - 25} more</p>`;
  }

  addMessage('assistant', html, true);
}

// ---- UI Helpers ----

function addMessage(type, content, isHtml = false) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.setAttribute('role', type === 'error' ? 'alert' : 'article');
  const inner = document.createElement('div');
  inner.className = 'msg-content';
  if (isHtml) inner.innerHTML = content;
  else inner.innerHTML = formatMarkdown(content);
  div.appendChild(inner);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function addLog(text, type = '') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = text;
  div.setAttribute('role', 'status');
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setStatus(state, text) {
  statusDot.className = `status-dot ${state === 'connected' ? '' : state}`;
  statusLabel.textContent = text;
  connectionStatus.textContent = text;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Strip all JSON/action blocks from text so user only sees natural language
function stripActionBlocks(text) {
  if (!text) return '';
  return text
    // ```json ... ``` or ``` ... ``` blocks containing JSON arrays with "type"
    .replace(/```(?:json)?\s*\n?\s*\[[\s\S]*?"type"\s*:[\s\S]*?\]\s*\n?\s*```/g, '')
    // ``` ... ``` blocks containing JSON objects with "type"
    .replace(/```(?:json)?\s*\n?\s*\{[\s\S]*?"type"\s*:[\s\S]*?\}\s*\n?\s*```/g, '')
    // <action>...</action> tags
    .replace(/<action>[\s\S]*?<\/action>/g, '')
    // Bare JSON arrays on their own lines: [{"type":...}]
    .replace(/^\s*\[\s*\{[^]*?"type"\s*:[^]*?\}\s*\]\s*$/gm, '')
    // Bare JSON objects on their own lines: {"type":...}
    .replace(/^\s*\{[^]*?"type"\s*:[^]*?\}\s*$/gm, '')
    // Remove lines that are just "json" (leftover from stripped code blocks)
    .replace(/^\s*json\s*$/gm, '')
    // Clean up excessive whitespace left behind
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatText(text) {
  const cleaned = stripActionBlocks(text);
  if (!cleaned) return '';
  return escapeHtml(cleaned).replace(/\n/g, '<br>');
}

function formatMarkdown(text) {
  if (!text) return '';
  let clean = stripActionBlocks(text);
  if (!clean) return '';

  // Escape HTML first
  clean = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Markdown formatting
  clean = clean
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*?)$/gm, '<h4 style="margin:4px 0;font-size:13px">$1</h4>')
    .replace(/^## (.*?)$/gm, '<h3 style="margin:6px 0;font-size:14px">$1</h3>')
    .replace(/^# (.*?)$/gm, '<h2 style="margin:8px 0;font-size:15px">$1</h2>')
    // Numbered lists: 1. item
    .replace(/^(\d+)\.\s+(.*?)$/gm, '<li value="$1">$2</li>')
    // Bullet lists: - item
    .replace(/^- (.*?)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  clean = clean.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/gs, '<ul style="margin:4px 0;padding-left:16px">$1</ul>');

  // Paragraphs
  clean = clean
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraph tags
  clean = '<p>' + clean + '</p>';

  // Clean empty paragraphs
  clean = clean
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p><br><\/p>/g, '')
    .replace(/<p>\s*<br>\s*<\/p>/g, '');

  return clean;
}

// ---- Q&A System: Extension asks user questions, answers stored persistently ----

let activeQuestion = null;
let questionTimeout = null;

function showQuestion(data) {
  const { questionId, question, fieldLabel, timeout = 180000 } = data; // 3 min default timeout

  // Remove any previous question
  dismissQuestion();

  const div = document.createElement('div');
  div.className = 'question-card';
  div.id = 'activeQuestion';
  div.dataset.questionId = questionId;

  const timeoutSec = Math.round(timeout / 1000);
  div.innerHTML = `
    <div class="question-header">
      <span class="question-icon">&#10067;</span>
      <span class="question-label">Question${fieldLabel ? ' — ' + escapeHtml(fieldLabel) : ''}</span>
      <span class="question-timer" id="questionTimer">${timeoutSec}s</span>
    </div>
    <div class="question-text">${escapeHtml(question)}</div>
    <div class="question-input-row">
      <input type="text" class="question-input" id="questionInput" placeholder="Type your answer..." autofocus />
      <button class="question-submit" id="questionSubmit">Send</button>
      <button class="question-skip" id="questionSkip">Skip</button>
    </div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const inputField = div.querySelector('#questionInput');
  const submitBtn = div.querySelector('#questionSubmit');
  const skipBtn = div.querySelector('#questionSkip');
  const timerEl = div.querySelector('#questionTimer');

  // Blink effect to draw attention
  div.classList.add('blink');
  setTimeout(() => div.classList.remove('blink'), 3000);

  // Focus the input
  setTimeout(() => inputField.focus(), 100);

  // Submit answer
  const submit = () => {
    const answer = inputField.value.trim();
    if (!answer) return;
    chrome.runtime.sendMessage({ type: 'ANSWER_QUESTION', questionId, answer, fieldLabel });
    div.classList.add('completed');
    div.innerHTML = `<div class="question-answered"><strong>Q:</strong> ${escapeHtml(question)}<br><strong>A:</strong> ${escapeHtml(answer)}</div>`;
    activeQuestion = null;
    if (questionTimeout) { clearInterval(questionTimeout); questionTimeout = null; }
  };

  submitBtn.addEventListener('click', submit);
  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  // Skip
  skipBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'ANSWER_QUESTION', questionId, answer: '', skipped: true });
    div.classList.add('failed');
    div.innerHTML = `<div class="question-answered"><strong>Q:</strong> ${escapeHtml(question)}<br><em>Skipped</em></div>`;
    activeQuestion = null;
    if (questionTimeout) { clearInterval(questionTimeout); questionTimeout = null; }
  });

  // Countdown timer
  let remaining = timeoutSec;
  activeQuestion = questionId;
  questionTimeout = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining + 's';
    if (remaining <= 0) {
      clearInterval(questionTimeout);
      questionTimeout = null;
      // Auto-skip on timeout
      chrome.runtime.sendMessage({ type: 'ANSWER_QUESTION', questionId, answer: '', skipped: true, timedOut: true });
      div.classList.add('failed');
      div.innerHTML = `<div class="question-answered"><strong>Q:</strong> ${escapeHtml(question)}<br><em>Timed out</em></div>`;
      activeQuestion = null;
    }
  }, 1000);
}

function dismissQuestion() {
  const existing = document.getElementById('activeQuestion');
  if (existing) existing.remove();
  if (questionTimeout) { clearInterval(questionTimeout); questionTimeout = null; }
  activeQuestion = null;
}

// ---- Session Log Display ----

async function showSessionLog() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_SESSION_LOG' });
    if (!resp?.ok) {
      addMessage('error', 'Could not load session log');
      return;
    }

    const { log, stats } = resp;
    let html = `<p><strong>Session Stats</strong></p>`;
    html += `<p>Applied: <strong>${stats.applied}</strong> | Skipped: <strong>${stats.skipped}</strong> | Cap: ${stats.sessionJobs}/${stats.dailyCap}</p>`;

    if (log.length === 0) {
      html += `<p style="color:var(--text-muted)">No applications yet this session.</p>`;
    } else {
      html += `<p style="font-size:11px;color:var(--text-muted)">${log.length} entries:</p>`;
      const recent = log.slice(-20).reverse();
      for (const entry of recent) {
        const statusIcon = entry.status === 'applied' ? '&#9989;'
          : entry.status === 'skipped' ? '&#9898;'
          : entry.status === 'error' ? '&#10060;' : '&#10067;';
        const time = new Date(entry.timestamp).toLocaleTimeString();
        html += `<div class="job-card-msg">
          <div class="job-title">${statusIcon} ${escapeHtml(entry.jobTitle)}</div>
          <div class="job-company">${escapeHtml(entry.company)}</div>
          <div class="job-meta">${entry.status.toUpperCase()} ${entry.reason ? '- ' + escapeHtml(entry.reason) : ''} &middot; ${time}</div>
        </div>`;
      }
    }

    addMessage('assistant', html, true);
  } catch (err) {
    addMessage('error', 'Error loading stats: ' + escapeHtml(err.message));
  }
}

// ---- Init ----

(async () => {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_API_KEY_STATUS' });
    if (!status?.configured) {
      setStatus('disconnected', 'API key not set');
      addMessage('error', 'Please set your API key in the extension popup (click the extension icon). You can also use <strong>Mock Mode</strong> to test without an API key.');
    } else {
      const { apiKey } = await chrome.storage.local.get(['apiKey']);
      if (apiKey === 'MOCK_MODE') {
        setStatus('connected', 'Mock Mode');
        connectionStatus.textContent = 'Mock Mode';
        addLog('Running in mock mode - responses are simulated', 'info');
      } else if (apiKey === 'DEMO_KEY') {
        setStatus('connected', 'Demo Mode');
        connectionStatus.textContent = 'Demo Mode';
        addLog('Demo mode - real Claude via local proxy', 'success');
      } else {
        setStatus('connected', 'Ready');
      }
    }

    const { state_profile } = await chrome.storage.local.get(['state_profile']);
    if (state_profile?.fullName || state_profile?.email) {
      const name = state_profile.fullName || state_profile.email || 'Unknown';
      addLog(`Profile: ${name}`, 'info');
    } else {
      addLog('No profile set - open extension popup to configure', 'info');
    }
  } catch {
    setStatus('disconnected', 'Extension error');
  }
})();
