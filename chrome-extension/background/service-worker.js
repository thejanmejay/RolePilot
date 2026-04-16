// Service Worker - Central orchestrator for the CUA loop
import { MessageRouter, MessageTypes } from '../lib/message-router.js';
import { StateManager } from '../lib/state-manager.js';
import { ClaudeClient, MOCK_API_KEY, DEMO_API_KEY } from '../lib/claude-client.js';
import { SYSTEM_PROMPT, BATCH_APPLY_PROMPT } from '../config/prompts.js';

const AUTO_EXECUTE_TYPES = [
  'scan_jobs', 'scan_form', 'scroll', 'wait', 'click_job', 'click_apply',
  'fill_form', 'next_step', 'dismiss_modal', 'navigate', 'click', 'type',
  'select', 'select_resume', 'debug_dom',
  // Workday-specific actions
  'workday_click_apply', 'workday_fill_form', 'workday_next_step',
  'workday_scan_form', 'workday_upload_resume', 'workday_fill_date',
  'workday_dismiss_modal', 'click_external_apply',
  // Universal career page actions
  'career_scan_form', 'career_click_apply', 'career_fill_form',
  'career_next_step', 'click_google_signin',
  // Web search
  'google_search'
];

const router = new MessageRouter();
const state = new StateManager();
const claude = new ClaudeClient();

// ---- Session tracking ----
const session = {
  appliedJobIds: new Set(),
  currentJobIndex: 0,
  totalJobsOnPage: 0,
  consecutiveErrors: 0,
  maxConsecutiveErrors: 5,
  feedbackLoopCount: 0,
  maxFeedbackLoops: 50,
  isRunning: false,
  appliedCount: 0,
  skippedCount: 0,
  dailyCap: 30,
  jobsAppliedThisSession: 0,
  sessionStartTime: null,
  log: [], // { jobTitle, company, jobId, status, reason, timestamp }
  pauseAfterN: 10, // pause after every N applications
  lastPauseAt: 0,
};

// ---- Pacing & Anti-Detection ----
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pacing delays (ms)
const PACE = {
  SHORT: () => randomDelay(1200, 2000),
  MEDIUM: () => randomDelay(2500, 4000),
  LONG: () => randomDelay(4000, 6000),
  BETWEEN_JOBS: () => randomDelay(3000, 7000),
  PAUSE_BREAK: () => randomDelay(120000, 180000), // 2-3 min pause
};

function shouldPauseForBreak() {
  return session.jobsAppliedThisSession > 0 &&
    session.jobsAppliedThisSession % session.pauseAfterN === 0 &&
    session.jobsAppliedThisSession !== session.lastPauseAt;
}

function logJob(jobTitle, company, jobId, status, reason = '') {
  session.log.push({
    jobTitle: jobTitle || 'Unknown',
    company: company || 'Unknown',
    jobId: jobId || '',
    status, // 'applied' | 'skipped' | 'error' | 'uncertain'
    reason,
    timestamp: new Date().toISOString()
  });
  // Keep log bounded
  if (session.log.length > 200) session.log = session.log.slice(-150);
  // Persist to storage
  chrome.storage.local.set({ applyPie_sessionLog: session.log }).catch(() => {});
}

// ---- Session Stop Conditions ----
function checkStopConditions() {
  // Daily cap reached
  if (session.jobsAppliedThisSession >= session.dailyCap) {
    return `Daily cap reached (${session.dailyCap} applications). Stopping to protect your account.`;
  }
  // Too many consecutive errors
  if (session.consecutiveErrors >= session.maxConsecutiveErrors) {
    return `${session.maxConsecutiveErrors} consecutive errors. Stopping — please check the page.`;
  }
  return null;
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});

// ---- Message Handlers ----

router.on(MessageTypes.CHAT_MESSAGE, async (message) => {
  const { text, autoExecute } = message;

  // Detect "stop" typed by user in chat
  const lowerInput = (text || '').trim().toLowerCase();
  if (lowerInput === 'stop' || lowerInput === 'stop.' || lowerInput === 'stop!' || lowerInput === 'halt') {
    console.log('[SW] User typed stop — halting all operations');
    claude.abort();
    session.isRunning = false;
    session.feedbackLoopCount = 0;
    feedbackInFlight = false;
    if (feedbackTimerId) { clearTimeout(feedbackTimerId); feedbackTimerId = null; }
    state.setState('conversation.isStreaming', false);
    const pending = state.getState('actions.pending');
    for (const action of pending) { state.failAction(action.id, 'Stopped by user'); }
    MessageRouter.broadcast(MessageTypes.STREAM_COMPLETE, {
      fullText: 'All operations stopped.',
      actions: [],
      usage: null
    });
    return;
  }

  // Check stop conditions before proceeding
  const stopReason = checkStopConditions();
  if (stopReason && session.isRunning) {
    session.isRunning = false;
    MessageRouter.broadcast(MessageTypes.STREAM_COMPLETE, {
      fullText: stopReason,
      actions: [],
      usage: null
    });
    return;
  }

  // Get page context from content script
  let pageContext = {};
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Always include the current tab URL in context, even if content script fails
      pageContext.tabUrl = tab.url || '';

      try {
        pageContext = await MessageRouter.sendToTab(tab.id, MessageTypes.GET_PAGE_CONTEXT);
        pageContext.tabUrl = tab.url || '';
      } catch {
        console.log('[SW] Content script not responding, injecting...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content-script.js']
          });
        } catch (injectErr) {
          console.log('[SW] Injection failed:', injectErr.message);
        }
        await new Promise(r => setTimeout(r, 1000));
        try {
          pageContext = await MessageRouter.sendToTab(tab.id, MessageTypes.GET_PAGE_CONTEXT);
          pageContext.tabUrl = tab.url || '';
        } catch {
          console.log('[SW] Content script still not responding after injection');
          // Still provide basic context so Claude can navigate
          pageContext = { tabUrl: tab.url || '', pageType: 'other', noContentScript: true };
        }
      }

      // If on LinkedIn but a career/ATS tab is open, include its context too
      if (tab.url?.includes('linkedin.com') && session.isRunning) {
        // Check for Workday tabs
        const wdTabs = await chrome.tabs.query({ url: ['*://*.myworkdayjobs.com/*', '*://www.myworkday.com/*'] });
        if (wdTabs.length > 0) {
          const wdTab = wdTabs[wdTabs.length - 1];
          try {
            await ensureContentScript(wdTab.id);
            const wdContext = await MessageRouter.sendToTab(wdTab.id, MessageTypes.GET_PAGE_CONTEXT);
            pageContext.workdayTab = {
              tabId: wdTab.id,
              url: wdTab.url,
              context: wdContext
            };
          } catch {
            pageContext.workdayTab = { tabId: wdTab.id, url: wdTab.url, error: 'Could not get Workday context' };
          }
        }
        // Check for other ATS tabs (Greenhouse, Lever, etc.)
        const atsUrls = [
          '*://*.greenhouse.io/*', '*://boards.greenhouse.io/*', '*://*.lever.co/*',
          '*://*.icims.com/*', '*://*.taleo.net/*', '*://*.ashbyhq.com/*',
          '*://*.smartrecruiters.com/*', '*://*.jobvite.com/*', '*://*.bamboohr.com/*',
          '*://*.workable.com/*', '*://*.successfactors.com/*', '*://*.breezy.hr/*',
          '*://*.recruitee.com/*', '*://*.jazz.co/*', '*://*.applytojob.com/*',
          '*://*.dover.com/*', '*://*.rippling.com/*'
        ];
        const atsTabs = await chrome.tabs.query({ url: atsUrls });
        if (atsTabs.length > 0) {
          const atsTab = atsTabs[atsTabs.length - 1];
          try {
            await ensureContentScript(atsTab.id);
            const atsContext = await MessageRouter.sendToTab(atsTab.id, MessageTypes.GET_PAGE_CONTEXT);
            pageContext.careerTab = {
              tabId: atsTab.id,
              url: atsTab.url,
              context: atsContext
            };
          } catch {
            pageContext.careerTab = { tabId: atsTab.id, url: atsTab.url, error: 'Could not get career page context' };
          }
        }
      }
    }
  } catch (err) { console.log('[SW] Page context error:', err.message); }

  // Detect login page / session expired
  const pageUrl = pageContext?.url || '';
  const isWorkdayLogin = pageContext?.workday?.isLoginPage;
  const isCareerLogin = pageContext?.careerPage?.loginRequired;
  const isLinkedInLogin = pageUrl.includes('linkedin.com') &&
    (pageUrl.includes('/login') || pageUrl.includes('/authwall') || pageUrl.includes('/checkpoint'));

  if (isLinkedInLogin) {
    session.isRunning = false;
    MessageRouter.broadcast(MessageTypes.STREAM_ERROR, {
      error: 'LinkedIn session expired or login required. Please log in and try again.'
    });
    return;
  }
  // For Workday/career page logins, don't stop — let Claude handle with wait/Google sign-in
  if (isWorkdayLogin || isCareerLogin) {
    // Claude will see loginRequired in the context and can ask user or try Google sign-in
  }

  // Get profile - try state first, then storage
  let profile = state.getState('profile');
  if (!profile?.fullName && !profile?.email) {
    const stored = await chrome.storage.local.get(['state_profile']);
    if (stored.state_profile) {
      profile = stored.state_profile;
      state.setState('profile', profile);
    }
  }

  // Build session status so Claude knows what's been done
  const sessionStatus = {
    appliedCount: session.appliedCount,
    skippedCount: session.skippedCount,
    currentJobIndex: session.currentJobIndex,
    totalJobsOnPage: session.totalJobsOnPage,
    appliedJobIds: Array.from(session.appliedJobIds).slice(-20),
    isRunning: session.isRunning,
    jobsAppliedThisSession: session.jobsAppliedThisSession,
    dailyCap: session.dailyCap,
    consecutiveErrors: session.consecutiveErrors
  };

  // Load saved answers so Claude can auto-fill known fields
  let savedAnswers = {};
  try { savedAnswers = await loadSavedAnswers(); } catch {}

  const contextMessage = [
    `[Current Page State]\n${JSON.stringify(pageContext, null, 2)}`,
    `[User Profile]\n${JSON.stringify(profile, null, 2)}`,
    `[Session Status]\n${JSON.stringify(sessionStatus, null, 2)}`,
    Object.keys(savedAnswers).length > 0 ? `[Saved Answers]\n${JSON.stringify(savedAnswers, null, 2)}` : '',
    `[User Message]\n${text}`
  ].filter(Boolean).join('\n\n');

  state.addMessage('user', text);

  const history = state.getState('conversation.messages').slice(-20);
  const apiMessages = [];
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  }
  apiMessages[apiMessages.length - 1] = { role: 'user', content: contextMessage };

  let systemPrompt = SYSTEM_PROMPT;
  const lowerText = text.toLowerCase();
  if (lowerText.includes('apply') || lowerText.includes('auto') || lowerText.includes('start') || lowerText.includes('job')) {
    systemPrompt += '\n\n' + BATCH_APPLY_PROMPT;
    if (!session.isRunning) {
      session.isRunning = true;
      session.sessionStartTime = Date.now();
    }
  }

  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  if (!apiKey) {
    MessageRouter.broadcast(MessageTypes.STREAM_ERROR, { error: 'API key not configured. Open extension settings.' });
    return;
  }

  state.setState('conversation.isStreaming', true);
  let fullText = '';
  let usage = null;

  try {
    for await (const chunk of claude.createMessageStream(apiKey, apiMessages, systemPrompt)) {
      if (chunk.type === 'text') {
        fullText += chunk.text;
        MessageRouter.broadcast(MessageTypes.STREAM_CHUNK, { text: chunk.text });
      }
      if (chunk.type === 'done') {
        fullText = chunk.fullText;
        usage = chunk.usage;
      }
    }

    state.addMessage('assistant', fullText);

    if (usage) {
      const { usageStats } = await chrome.storage.local.get(['usageStats']);
      const stats = usageStats || { totalInputTokens: 0, totalOutputTokens: 0, callCount: 0 };
      stats.totalInputTokens += usage.input_tokens || 0;
      stats.totalOutputTokens += usage.output_tokens || 0;
      stats.callCount += 1;
      stats.lastUsed = new Date().toISOString();
      await chrome.storage.local.set({ usageStats: stats });
    }

    const actions = ClaudeClient.extractActions(fullText);
    let lastAutoResult = null;
    let lastAutoAction = null;

    if (actions.length > 0) {
      for (const action of actions) {
        const shouldAutoExec = autoExecute || AUTO_EXECUTE_TYPES.includes(action.type);
        action.autoExecuted = shouldAutoExec;
        const actionObj = state.addAction(action);
        if (shouldAutoExec) {
          lastAutoResult = await executeActionOnTab(actionObj, true); // skipFeedback=true
          lastAutoAction = actionObj;
        }
      }
    }

    session.consecutiveErrors = 0;

    MessageRouter.broadcast(MessageTypes.STREAM_COMPLETE, {
      fullText,
      actions,
      usage
    });

    // Send feedback only for the LAST auto-executed action (prevents competing loops)
    if (lastAutoAction && lastAutoResult) {
      await feedbackToAgent(lastAutoAction, lastAutoResult);
    } else if (actions.length === 0 && session.isRunning) {
      // Claude responded with no actions but we're still in auto mode — nudge it
      console.log('[SW] No actions in response while running, nudging agent');
      scheduleFeedback('No actions were returned. You MUST include an action block. Continue the workflow — scan jobs, click a job, click apply, fill form, or next step.');
    }

  } catch (err) {
    session.consecutiveErrors++;
    MessageRouter.broadcast(MessageTypes.STREAM_ERROR, { error: err.message });

    const stopReason = checkStopConditions();
    if (stopReason) {
      session.isRunning = false;
      MessageRouter.broadcast(MessageTypes.STREAM_ERROR, { error: stopReason });
    }
  } finally {
    state.setState('conversation.isStreaming', false);
  }
});

router.on(MessageTypes.CONFIRM_ACTION, async (message) => {
  const { actionId } = message;
  const pending = state.getState('actions.pending');
  const action = pending.find(a => a.id === actionId);
  if (!action) return { error: 'Action not found' };
  const result = await executeActionOnTab(action);
  if (session.isRunning && result) {
    await feedbackToAgent(action, result);
  }
  return result;
});

router.on(MessageTypes.SKIP_ACTION, async (message) => {
  state.failAction(message.actionId, 'Skipped by user');
  return { ok: true };
});

router.on(MessageTypes.EXECUTE_ACTION, async (message) => {
  return await executeActionOnTab(message.action);
});

router.on(MessageTypes.SET_API_KEY, async (message) => {
  const { apiKey } = message;
  const valid = await claude.validateApiKey(apiKey);
  if (valid) {
    await chrome.storage.local.set({ apiKey });
    state.setState('extension.apiKeyConfigured', true);
    state.setState('extension.apiKeyValid', true);
    return { ok: true, valid: true };
  }
  return { ok: false, valid: false, error: 'Invalid API key' };
});

router.on(MessageTypes.GET_API_KEY_STATUS, async () => {
  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  return { configured: !!apiKey, valid: state.getState('extension.apiKeyValid') };
});

router.on(MessageTypes.SAVE_PROFILE, async (message) => {
  state.setState('profile', message.profile);
  await chrome.storage.local.set({ state_profile: message.profile });
  return { ok: true };
});

router.on(MessageTypes.STOP_EXECUTION, async () => {
  console.log('[SW] STOP_EXECUTION received — killing everything');
  claude.abort();
  session.isRunning = false;
  session.feedbackLoopCount = 0;
  feedbackInFlight = false;
  // Cancel any scheduled feedback
  if (feedbackTimerId) {
    clearTimeout(feedbackTimerId);
    feedbackTimerId = null;
  }
  state.setState('conversation.isStreaming', false);
  const pending = state.getState('actions.pending');
  for (const action of pending) {
    state.failAction(action.id, 'Stopped by user');
  }
  return { ok: true };
});

router.on(MessageTypes.OPEN_SIDEBAR, async (message) => {
  if (message.tabId) await chrome.sidePanel.open({ tabId: message.tabId });
  return { ok: true };
});

// ---- Get Session Log ----
router.on('GET_SESSION_LOG', async () => {
  return { ok: true, log: session.log, stats: {
    applied: session.appliedCount,
    skipped: session.skippedCount,
    errors: session.consecutiveErrors,
    sessionJobs: session.jobsAppliedThisSession,
    dailyCap: session.dailyCap
  }};
});

// ---- Resume Analysis ----
router.on(MessageTypes.ANALYZE_RESUME, async (message) => {
  const { resumeText } = message;
  if (!resumeText || resumeText.length < 20) {
    return { ok: false, error: 'Resume text too short or empty' };
  }

  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  if (!apiKey || apiKey === 'MOCK_MODE') {
    return { ok: false, error: 'A real API key is required for resume analysis. Set one in the Setup tab.' };
  }

  const systemPrompt = `You are a resume parser. Extract structured profile data from the resume text. Return ONLY a valid JSON object with these fields (use empty string if not found):
{
  "fullName": "First Last",
  "email": "email@example.com",
  "phone": "+1234567890",
  "location": "City, State/Country",
  "experience": "number of years (just the number)",
  "resumeSummary": "2-3 sentence professional summary highlighting key skills, technologies, and experience level"
}
Return ONLY the JSON object, no markdown, no explanation.`;

  const messages = [{ role: 'user', content: `Parse this resume:\n\n${resumeText.slice(0, 8000)}` }];

  try {
    let fullText = '';
    for await (const chunk of claude.createMessageStream(apiKey, messages, systemPrompt)) {
      if (chunk.type === 'text') fullText += chunk.text;
      if (chunk.type === 'done') fullText = chunk.fullText;
    }

    let profile;
    try {
      profile = JSON.parse(fullText.trim());
    } catch {
      const jsonMatch = fullText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profile = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        return { ok: false, error: 'Could not parse AI response' };
      }
    }

    state.setState('profile', profile);
    await chrome.storage.local.set({ state_profile: profile });
    return { ok: true, profile };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---- Q&A System: Ask user questions, store answers persistently ----

const ANSWERS_STORAGE_KEY = 'applyPie_savedAnswers';
let pendingQuestions = {}; // questionId -> { resolve, reject, timeout }

// Load saved answers
async function loadSavedAnswers() {
  try {
    const data = await chrome.storage.local.get([ANSWERS_STORAGE_KEY]);
    return data[ANSWERS_STORAGE_KEY] || {};
  } catch { return {}; }
}

// Save an answer
async function saveAnswer(fieldLabel, answer) {
  if (!fieldLabel || !answer) return;
  const answers = await loadSavedAnswers();
  const key = fieldLabel.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  answers[key] = {
    label: fieldLabel,
    answer: answer,
    usedCount: (answers[key]?.usedCount || 0) + 1,
    lastUsed: new Date().toISOString()
  };
  await chrome.storage.local.set({ [ANSWERS_STORAGE_KEY]: answers });
}

// Look up a saved answer
async function lookupAnswer(fieldLabel) {
  const answers = await loadSavedAnswers();
  const key = fieldLabel.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (answers[key]) return answers[key].answer;
  // Fuzzy match: try partial key matching
  for (const [k, v] of Object.entries(answers)) {
    if (k.includes(key) || key.includes(k)) return v.answer;
  }
  return null;
}

// Ask user a question via sidebar (returns a Promise that resolves with the answer)
function askUser(question, fieldLabel, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const questionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Set timeout for auto-skip
    const timer = setTimeout(() => {
      delete pendingQuestions[questionId];
      resolve(null);
    }, timeoutMs);

    pendingQuestions[questionId] = { resolve, timer };

    // Broadcast to sidebar
    MessageRouter.broadcast('ASK_USER', { questionId, question, fieldLabel, timeout: timeoutMs });
  });
}

router.on('ANSWER_QUESTION', async (message) => {
  const { questionId, answer, fieldLabel, skipped, timedOut } = message;
  const pending = pendingQuestions[questionId];

  if (pending) {
    clearTimeout(pending.timer);
    delete pendingQuestions[questionId];

    if (answer && !skipped && !timedOut) {
      // Save answer for future use
      if (fieldLabel) await saveAnswer(fieldLabel, answer);
      pending.resolve(answer);
    } else {
      pending.resolve(null);
    }
  }

  return { ok: true };
});

// Get all saved answers (for Claude to use)
router.on('GET_SAVED_ANSWERS', async () => {
  const answers = await loadSavedAnswers();
  return { ok: true, answers };
});

// Clear saved answers
router.on('CLEAR_SAVED_ANSWERS', async () => {
  await chrome.storage.local.remove([ANSWERS_STORAGE_KEY]);
  return { ok: true };
});

router.on('RESET_SESSION', async () => {
  session.appliedJobIds.clear();
  session.currentJobIndex = 0;
  session.totalJobsOnPage = 0;
  session.consecutiveErrors = 0;
  session.feedbackLoopCount = 0;
  session.isRunning = false;
  session.appliedCount = 0;
  session.skippedCount = 0;
  session.jobsAppliedThisSession = 0;
  session.lastPauseAt = 0;
  session.sessionStartTime = null;
  // Don't clear log — it persists for review
  return { ok: true };
});

// ---- Action Execution ----

async function ensureContentScript(tabId) {
  try {
    const response = await MessageRouter.sendToTab(tabId, 'PING');
    if (response?.ok) return;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script.js']
      });
    } catch (e) {
      console.log('[SW] Could not inject content script:', e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

// Helper to detect if a URL is a Workday page
function isWorkdayUrl(url) {
  return /\.wd\d+\.myworkdayjobs\.com/.test(url) || url?.includes('myworkday.com');
}

// Helper to detect if a URL is any known career/ATS page
const ATS_URL_PATTERNS = [
  /\.wd\d+\.myworkdayjobs\.com/,
  /myworkday\.com/,
  /greenhouse\.io/,
  /lever\.co/,
  /icims\.com/,
  /taleo\.net/,
  /oraclecloud\.com.*\/hcmUI\//,
  /ashbyhq\.com/,
  /smartrecruiters\.com/,
  /jobvite\.com/,
  /bamboohr\.com/,
  /workable\.com/,
  /successfactors\.com/,
  /breezy\.hr/,
  /recruitee\.com/,
  /jazz\.co/,
  /applytojob\.com/,
  /dover\.com/,
  /rippling\.com/
];

function isCareerUrl(url) {
  if (!url) return false;
  return ATS_URL_PATTERNS.some(p => p.test(url));
}

async function executeActionOnTab(action, skipFeedback = false) {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    // For Workday actions, find the Workday tab if current tab isn't one
    const isWdAction = action.type?.startsWith('workday_');
    if (isWdAction && !isWorkdayUrl(tab.url)) {
      const wdTabs = await chrome.tabs.query({ url: ['*://*.myworkdayjobs.com/*', '*://www.myworkday.com/*'] });
      if (wdTabs.length > 0) {
        tab = wdTabs[wdTabs.length - 1];
        await chrome.tabs.update(tab.id, { active: true });
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // For career page actions, find the career/ATS tab if current tab isn't one
    const isCareerAction = action.type?.startsWith('career_') || action.type === 'click_google_signin';
    if (isCareerAction && !isCareerUrl(tab.url) && !tab.url?.includes('linkedin.com')) {
      // Already on an ATS page via content script auto-delegation — no need to switch
    } else if (isCareerAction && !isCareerUrl(tab.url)) {
      const atsUrls = [
        '*://*.greenhouse.io/*', '*://boards.greenhouse.io/*', '*://*.lever.co/*',
        '*://*.icims.com/*', '*://*.taleo.net/*', '*://*.ashbyhq.com/*',
        '*://*.smartrecruiters.com/*', '*://*.jobvite.com/*', '*://*.bamboohr.com/*',
        '*://*.workable.com/*', '*://*.successfactors.com/*', '*://*.breezy.hr/*',
        '*://*.recruitee.com/*', '*://*.jazz.co/*', '*://*.applytojob.com/*',
        '*://*.dover.com/*', '*://*.rippling.com/*',
        '*://*.myworkdayjobs.com/*', '*://www.myworkday.com/*'
      ];
      const atsTabs = await chrome.tabs.query({ url: atsUrls });
      if (atsTabs.length > 0) {
        tab = atsTabs[atsTabs.length - 1];
        await chrome.tabs.update(tab.id, { active: true });
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Handle navigate at service worker level
    if (action.type === 'navigate' && action.url) {
      const currentUrl = tab.url || '';
      const targetUrl = new URL(action.url);
      const alreadyThere = currentUrl.includes(targetUrl.pathname);

      if (alreadyThere) {
        const result = { ok: true, data: { navigated: currentUrl, alreadyOnPage: true } };
        state.completeAction(action.id, result);
        MessageRouter.broadcast(MessageTypes.ACTION_RESULT, { actionId: action.id, result });
        return result;
      }

      await chrome.tabs.update(tab.id, { url: action.url });
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
      });
      await new Promise(r => setTimeout(r, PACE.LONG()));

      // Always inject content script after navigation (any domain)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content-script.js']
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log('[SW] Post-navigate injection failed:', e.message);
      }

      const navResult = { ok: true, data: { navigated: action.url } };
      state.completeAction(action.id, navResult);
      MessageRouter.broadcast(MessageTypes.ACTION_RESULT, { actionId: action.id, result: navResult });
      return navResult;
    }

    // Handle google_search at service worker level
    if (action.type === 'google_search' && action.query) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(action.query)}`;
      await chrome.tabs.update(tab.id, { url: searchUrl });
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
      });
      await new Promise(r => setTimeout(r, 2000));

      // Extract search results from the Google page
      let searchResults = [];
      try {
        const extraction = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const results = [];
            // Google search result links
            document.querySelectorAll('div.g a[href], div[data-sokoban-container] a[href]').forEach(a => {
              const href = a.href;
              if (!href || href.includes('google.com') || href.includes('webcache')) return;
              const title = a.querySelector('h3')?.textContent || a.textContent?.slice(0, 100);
              if (title && href.startsWith('http')) {
                results.push({ title: title.trim(), url: href });
              }
            });
            // Deduplicate by URL
            const seen = new Set();
            return results.filter(r => {
              if (seen.has(r.url)) return false;
              seen.add(r.url);
              return true;
            }).slice(0, 10);
          }
        });
        searchResults = extraction[0]?.result || [];
      } catch (e) {
        console.log('[SW] Google search extraction failed:', e.message);
      }

      const searchResult = { ok: true, data: { query: action.query, results: searchResults, url: searchUrl } };
      state.completeAction(action.id, searchResult);
      MessageRouter.broadcast(MessageTypes.ACTION_RESULT, { actionId: action.id, result: searchResult });
      return searchResult;
    }

    await ensureContentScript(tab.id);
    const result = await MessageRouter.sendToTab(tab.id, MessageTypes.EXECUTE_ACTION, { action });

    if (result?.ok) {
      state.completeAction(action.id, result);

      // Track applied jobs (LinkedIn Easy Apply and Workday)
      if (result.submitted || result.data?.submitted || result.message?.includes('submitted')
          || result.message?.includes('Workday application submitted')) {
        const selectedJob = result.data?.selectedJob || state.getState('pageContext.selectedJob');
        if (selectedJob?.linkedinId) {
          session.appliedJobIds.add(selectedJob.linkedinId);
        }
        session.appliedCount++;
        session.jobsAppliedThisSession++;
        session.currentJobIndex++;
        session.feedbackLoopCount = 0;
        session.consecutiveErrors = 0;

        // Log successful application
        logJob(
          selectedJob?.title || 'Unknown',
          selectedJob?.company || 'Unknown',
          selectedJob?.linkedinId || '',
          'applied'
        );
      }

      // Track scanned jobs count
      if (action.type === 'scan_jobs' && result.data?.jobs) {
        session.totalJobsOnPage = result.data.jobs.length;
      }
    } else {
      state.failAction(action.id, result?.error || 'Unknown error');
      session.consecutiveErrors++;
    }

    MessageRouter.broadcast(MessageTypes.ACTION_RESULT, { actionId: action.id, result });
    return result;
  } catch (err) {
    state.failAction(action.id, err.message);
    session.consecutiveErrors++;
    MessageRouter.broadcast(MessageTypes.ACTION_RESULT, {
      actionId: action.id,
      result: { ok: false, error: err.message }
    });
    return { ok: false, error: err.message };
  }
}

let feedbackInFlight = false;
let feedbackTimerId = null;

function scheduleFeedback(continueMsg, delayMs) {
  // Don't schedule if already stopped
  if (!session.isRunning) return;

  if (feedbackInFlight) {
    console.log('[SW] Feedback already in flight, queuing:', continueMsg.slice(0, 60));
  }
  feedbackInFlight = true;

  const delay = delayMs || PACE.SHORT();
  // Clear any previously scheduled feedback
  if (feedbackTimerId) clearTimeout(feedbackTimerId);

  feedbackTimerId = setTimeout(() => {
    feedbackTimerId = null;
    // Double-check session is still running before sending
    if (!session.isRunning) {
      feedbackInFlight = false;
      return;
    }
    router.handle({
      type: MessageTypes.CHAT_MESSAGE,
      text: continueMsg,
      autoExecute: true
    }, null).catch(err => {
      console.error('[SW] Feedback loop error:', err.message);
      session.consecutiveErrors++;
    }).finally(() => {
      feedbackInFlight = false;
    });
  }, delay);
}

async function feedbackToAgent(action, result) {
  // Circuit breakers
  session.feedbackLoopCount++;
  if (session.feedbackLoopCount > session.maxFeedbackLoops) {
    console.log('[SW] Max feedback loops reached, moving to next job');
    session.feedbackLoopCount = 0;
    session.currentJobIndex++;
    logJob('Unknown', 'Unknown', '', 'error', 'Max feedback loops reached');
    return;
  }

  if (session.consecutiveErrors >= session.maxConsecutiveErrors) {
    console.log('[SW] Too many consecutive errors, stopping');
    session.isRunning = false;
    return;
  }

  if (!session.isRunning && !result?.ok) return;

  // Check stop conditions
  const stopReason = checkStopConditions();
  if (stopReason) {
    session.isRunning = false;
    MessageRouter.broadcast(MessageTypes.STREAM_COMPLETE, {
      fullText: stopReason,
      actions: [],
      usage: null
    });
    return;
  }

  const feedbackMsg = `[Action Result: ${action.type}]\n${JSON.stringify(result.data || result, null, 2)}`;
  state.addMessage('user', feedbackMsg);

  let continueMsg = '';
  let delay = undefined; // use default

  if (result.data?.submitted || result.submitted || result.message?.includes('submitted')
      || result.message?.includes('Workday application submitted')) {
    continueMsg = `Application #${session.appliedCount} submitted. Move to job index ${session.currentJobIndex}. Already applied: [${Array.from(session.appliedJobIds).slice(-10).join(', ')}]`;
    session.feedbackLoopCount = 0;

    // If Workday submission, try to switch back to LinkedIn tab
    if (result.message?.includes('Workday')) {
      try {
        const linkedinTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
        if (linkedinTabs.length > 0) {
          await chrome.tabs.update(linkedinTabs[0].id, { active: true });
          continueMsg += ' Switched back to LinkedIn.';
        }
      } catch {}
    }

    // Pacing: random delay between jobs
    delay = PACE.BETWEEN_JOBS();

    // Break pause after every N applications
    if (shouldPauseForBreak()) {
      session.lastPauseAt = session.jobsAppliedThisSession;
      console.log(`[SW] Pausing for break after ${session.jobsAppliedThisSession} applications`);
      delay = PACE.PAUSE_BREAK();
      continueMsg += ` (Paused ${Math.round(delay / 1000)}s for pacing)`;
    }
  } else if (!result.ok) {
    const errMsg = result.error || 'unknown';
    const isConnectionError = errMsg.includes('Could not establish connection') ||
      errMsg.includes('Receiving end does not exist') ||
      errMsg.includes('message channel closed');

    if (isConnectionError) {
      // Don't skip to next job — content script just needs reinjection
      continueMsg = `Connection lost (content script not loaded). Retrying — wait for page to load, then continue the same action.`;
      delay = PACE.MEDIUM();
      // Try to reinject content script now
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content-script.js'] });
        }
      } catch {}
    } else {
      continueMsg = `Error on ${action.type}: ${errMsg}. Dismiss any modal and move to next job (index ${session.currentJobIndex}).`;
      session.currentJobIndex++;
      session.skippedCount++;
      logJob('Unknown', 'Unknown', '', 'error', errMsg);
    }
  } else if (result.data?.fields || result.data?.currentForm?.fields) {
    continueMsg = 'Form fields available. Fill them using profile data and continue.';
  } else if (action.type === 'navigate' || action.type === 'click_job') {
    continueMsg = 'Page loaded. Continue with the workflow.';
    delay = PACE.MEDIUM();
  } else if (action.type === 'scan_jobs' && result.data?.jobs) {
    const easyApplyJobs = result.data.jobs.filter(j => j.easyApply);
    const unapplied = easyApplyJobs.filter(j => !session.appliedJobIds.has(j.linkedinId));
    session.totalJobsOnPage = result.data.jobs.length;
    continueMsg = `Found ${result.data.jobs.length} jobs (${easyApplyJobs.length} Easy Apply, ${unapplied.length} unapplied). Start from index ${session.currentJobIndex}. Skip jobs with IDs: [${Array.from(session.appliedJobIds).slice(-10).join(', ')}]`;
  } else if (action.type === 'click_apply') {
    continueMsg = 'Easy Apply modal opened. Scan and fill the form.';
  } else if (action.type === 'fill_form') {
    continueMsg = 'Form filled. Click next to proceed.';
  } else if (action.type === 'next_step') {
    continueMsg = 'Stepped forward. Check for more form fields or submit.';
  } else if (action.type === 'dismiss_modal') {
    continueMsg = `Modal dismissed. Move to next job at index ${session.currentJobIndex}.`;
    session.feedbackLoopCount = 0;
    delay = PACE.BETWEEN_JOBS();
  } else if (action.type === 'click') {
    continueMsg = 'Element clicked. Continue with the workflow.';
  } else if (action.type === 'scan_form' || action.type === 'workday_scan_form') {
    continueMsg = 'Form scanned. Fill the fields using profile data.';
  } else if (action.type === 'type' || action.type === 'select') {
    continueMsg = 'Field updated. Continue with the form.';
  } else if (action.type === 'click_external_apply') {
    continueMsg = 'External Apply clicked. A new tab may have opened (Workday). Check the new tab and start filling the Workday form.';
    delay = PACE.LONG();
  } else if (action.type === 'workday_click_apply') {
    continueMsg = 'Workday Apply button clicked. Scan the form and fill fields.';
  } else if (action.type === 'workday_fill_form') {
    continueMsg = 'Workday form fields filled. Click next to proceed to the next step.';
  } else if (action.type === 'workday_next_step') {
    continueMsg = 'Workday step completed. Check for more form fields or submit.';
  } else if (action.type === 'workday_fill_date') {
    continueMsg = 'Date field filled. Continue with remaining fields.';
  } else if (action.type === 'career_scan_form') {
    continueMsg = 'Career page form scanned. Fill the fields using profile data and detectedType hints.';
  } else if (action.type === 'career_click_apply') {
    continueMsg = 'Career page Apply button clicked. Scan the form and fill fields.';
  } else if (action.type === 'career_fill_form') {
    continueMsg = 'Career page form filled. Click next/submit to proceed.';
  } else if (action.type === 'career_next_step') {
    continueMsg = 'Career page step completed. Check for more form fields or submit.';
  } else if (action.type === 'click_google_signin') {
    continueMsg = 'Google sign-in attempted. Wait for authentication to complete, then scan the form.';
    delay = PACE.LONG();
  } else if (action.type === 'google_search') {
    const results = result.data?.results || [];
    if (results.length > 0) {
      const summaries = results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} — ${r.url}`).join('\n');
      continueMsg = `Google search returned ${results.length} results:\n${summaries}\nPick the best career/jobs URL and navigate to it.`;
    } else {
      continueMsg = 'Google search returned no results. Try a different search query.';
    }
  } else {
    continueMsg = `Action ${action.type} completed. Continue with the workflow.`;
  }

  scheduleFeedback(continueMsg, delay);
}

// ---- Main Listener ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageTypes.PAGE_CONTEXT_RESPONSE) return false;

  // Broadcast messages (STREAM_CHUNK, etc.) don't expect a response
  const noResponseTypes = [
    MessageTypes.STREAM_CHUNK, MessageTypes.STREAM_COMPLETE,
    MessageTypes.STREAM_ERROR, MessageTypes.ACTION_RESULT,
    MessageTypes.STATE_UPDATE
  ];
  if (noResponseTypes.includes(message.type)) return false;

  router.handle(message, sender).then(result => {
    sendResponse(result !== undefined ? result : { ok: true });
  }).catch(err => {
    sendResponse({ error: err.message });
  });

  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const url = tab.url || '';
    // Inject on LinkedIn, known ATS pages, and any http/https page when session is running
    if (url.includes('linkedin.com') || isCareerUrl(url) ||
        (session.isRunning && (url.startsWith('http://') || url.startsWith('https://')))) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script.js']
      }).catch(() => {});
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  state.setState('extension.apiKeyConfigured', !!apiKey);

  // Load previous session log
  const { applyPie_sessionLog } = await chrome.storage.local.get(['applyPie_sessionLog']);
  if (applyPie_sessionLog) session.log = applyPie_sessionLog;

  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  const atsTabs = await chrome.tabs.query({ url: [
    '*://*.myworkdayjobs.com/*', '*://www.myworkday.com/*',
    '*://*.greenhouse.io/*', '*://boards.greenhouse.io/*',
    '*://*.lever.co/*', '*://*.icims.com/*', '*://*.taleo.net/*',
    '*://*.ashbyhq.com/*', '*://*.smartrecruiters.com/*',
    '*://*.jobvite.com/*', '*://*.bamboohr.com/*', '*://*.workable.com/*',
    '*://*.successfactors.com/*', '*://*.breezy.hr/*', '*://*.recruitee.com/*',
    '*://*.jazz.co/*', '*://*.applytojob.com/*', '*://*.dover.com/*', '*://*.rippling.com/*'
  ] });
  for (const tab of [...tabs, ...atsTabs]) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content-script.js']
    }).catch(() => {});
  }
});
