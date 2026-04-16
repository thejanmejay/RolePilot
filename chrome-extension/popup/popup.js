// Tab switching
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Load saved data
chrome.storage.local.get(['apiKey', 'state_profile', 'usageStats'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
  if (result.state_profile) {
    const p = result.state_profile;
    document.getElementById('fullName').value = p.fullName || '';
    document.getElementById('email').value = p.email || '';
    document.getElementById('phone').value = p.phone || '';
    document.getElementById('location').value = p.location || '';
    document.getElementById('experience').value = p.experience || '';
    document.getElementById('resumeSummary').value = p.resumeSummary || '';
  }
  if (result.usageStats) updateStats(result.usageStats);
});

// ---- Resume Upload & AI Analysis ----

let pendingResumeText = null;

document.getElementById('resumeFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const status = document.getElementById('resumeStatus');
  const uploadLabel = document.querySelector('.upload-label');
  const uploadTitle = document.getElementById('uploadTitle');
  const analyzeBtn = document.getElementById('analyzeResume');

  uploadLabel.classList.add('has-file');
  uploadTitle.textContent = file.name;

  showStatus(status, 'loading', 'Reading file...');

  try {
    if (file.name.endsWith('.txt')) {
      pendingResumeText = await file.text();
    } else if (file.name.endsWith('.pdf')) {
      pendingResumeText = await extractPdfText(file);
    } else {
      showStatus(status, 'error', 'Unsupported file type. Use PDF or TXT.');
      return;
    }

    if (!pendingResumeText || pendingResumeText.trim().length < 20) {
      showStatus(status, 'error', 'Could not extract text from file. Try a TXT file instead.');
      return;
    }

    showStatus(status, 'success', `Extracted ${pendingResumeText.length} chars. Click "Analyze" to auto-fill profile.`);
    analyzeBtn.style.display = '';
  } catch (err) {
    showStatus(status, 'error', 'Error reading file: ' + err.message);
  }
});

document.getElementById('analyzeResume').addEventListener('click', async () => {
  if (!pendingResumeText) return;

  const status = document.getElementById('resumeStatus');
  const analyzeBtn = document.getElementById('analyzeResume');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  showStatus(status, 'loading', 'AI is analyzing your resume...');

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'ANALYZE_RESUME',
      resumeText: pendingResumeText
    });

    if (result?.ok && result.profile) {
      const p = result.profile;
      document.getElementById('fullName').value = p.fullName || '';
      document.getElementById('email').value = p.email || '';
      document.getElementById('phone').value = p.phone || '';
      document.getElementById('location').value = p.location || '';
      document.getElementById('experience').value = p.experience || '';
      document.getElementById('resumeSummary').value = p.resumeSummary || '';
      showStatus(status, 'success', 'Profile auto-filled from resume! Review and click "Save Profile".');
    } else {
      showStatus(status, 'error', result?.error || 'Analysis failed');
    }
  } catch (err) {
    showStatus(status, 'error', err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze with AI';
  }
});

// Basic PDF text extraction using browser APIs
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Decode the raw PDF bytes to find text content
  // This is a lightweight approach that extracts text from PDF streams
  const rawText = new TextDecoder('latin1').decode(bytes);
  const textParts = [];

  // Method 1: Extract text between BT/ET (Begin Text / End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(rawText)) !== null) {
    const block = match[1];
    // Extract strings in parentheses (PDF text strings)
    const strRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const decoded = strMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\(.)/g, '$1');
      if (decoded.trim()) textParts.push(decoded);
    }
    // Extract hex strings <...>
    const hexRegex = /<([0-9a-fA-F]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      let decoded = '';
      for (let i = 0; i < hex.length; i += 2) {
        decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      if (decoded.trim()) textParts.push(decoded);
    }
  }

  // Method 2: If BT/ET didn't work well, try extracting from decoded streams
  if (textParts.join(' ').trim().length < 50) {
    // Look for readable ASCII runs (fallback)
    const asciiRuns = rawText.match(/[\x20-\x7E]{10,}/g) || [];
    const filtered = asciiRuns.filter(s =>
      !s.includes('obj') && !s.includes('endobj') && !s.includes('stream') &&
      !s.includes('/Type') && !s.includes('/Font') && !s.includes('xref') &&
      s.length < 500
    );
    if (filtered.length > 0) {
      return filtered.join(' ');
    }
  }

  const result = textParts.join(' ').replace(/\s+/g, ' ').trim();
  return result;
}

// ---- Save & validate API key ----

document.getElementById('saveKey').addEventListener('click', async () => {
  const key = document.getElementById('apiKey').value.trim();
  const status = document.getElementById('keyStatus');

  if (!key) {
    showStatus(status, 'error', 'Please enter an API key');
    return;
  }

  showStatus(status, 'loading', 'Validating...');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
    if (result?.valid) {
      showStatus(status, 'success', 'API key validated and saved');
    } else {
      showStatus(status, 'error', result?.error || 'Invalid API key');
    }
  } catch (err) {
    showStatus(status, 'error', err.message);
  }
});

// Demo mode
document.getElementById('demoMode').addEventListener('click', async () => {
  const status = document.getElementById('keyStatus');
  showStatus(status, 'loading', 'Checking demo proxy server...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: 'DEMO_KEY' });
    if (result?.valid) {
      document.getElementById('apiKey').value = 'DEMO_KEY';
      showStatus(status, 'success', 'Demo mode active! Using real Claude via local proxy.');
    } else {
      showStatus(status, 'error', 'Demo proxy not running. Start it with: node demo-server/server.js');
    }
  } catch (err) {
    showStatus(status, 'error', err.message);
  }
});

// Mock mode
document.getElementById('mockMode').addEventListener('click', async () => {
  const status = document.getElementById('keyStatus');
  showStatus(status, 'loading', 'Enabling mock mode...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: 'MOCK_MODE' });
    if (result?.valid) {
      document.getElementById('apiKey').value = 'MOCK_MODE';
      showStatus(status, 'success', 'Mock mode enabled! No API calls will be made.');
    } else {
      showStatus(status, 'error', 'Failed to enable mock mode');
    }
  } catch (err) {
    showStatus(status, 'error', err.message);
  }
});

// Save profile
document.getElementById('saveProfile').addEventListener('click', async () => {
  const profile = {
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    location: document.getElementById('location').value.trim(),
    experience: document.getElementById('experience').value.trim(),
    resumeSummary: document.getElementById('resumeSummary').value.trim()
  };

  const status = document.getElementById('profileStatus');
  try {
    await chrome.runtime.sendMessage({ type: 'SAVE_PROFILE', profile });
    showStatus(status, 'success', 'Profile saved');
  } catch (err) {
    showStatus(status, 'error', err.message);
  }
});

// Open side panel
document.getElementById('openPanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('linkedin.com')) {
    showStatus(document.getElementById('keyStatus'), 'error', 'Navigate to LinkedIn first');
    return;
  }
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

// Usage stats
function updateStats(stats) {
  document.getElementById('statCalls').textContent = stats.callCount || 0;
  document.getElementById('statInput').textContent = formatNumber(stats.totalInputTokens || 0);
  document.getElementById('statOutput').textContent = formatNumber(stats.totalOutputTokens || 0);
  document.getElementById('statLast').textContent = stats.lastUsed
    ? new Date(stats.lastUsed).toLocaleDateString() : 'Never';
}

document.getElementById('resetStats').addEventListener('click', () => {
  const empty = { totalInputTokens: 0, totalOutputTokens: 0, callCount: 0 };
  chrome.storage.local.set({ usageStats: empty });
  updateStats(empty);
});

function showStatus(el, type, text) {
  el.className = `status-msg ${type}`;
  el.textContent = text;
  if (type !== 'loading') {
    setTimeout(() => { el.className = 'status-msg'; }, 5000);
  }
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
