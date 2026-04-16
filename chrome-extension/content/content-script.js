// Content Script - Bridge between extension and LinkedIn DOM
// Stealth mode enabled - avoids bot detection patterns

(() => {
  // Prevent double initialization
  if (window.__linkedinHunterLoaded) {
    // Already loaded — but check if previous instance's extension context died
    try {
      if (chrome.runtime?.id) return; // Still valid, skip
    } catch {}
    // Previous instance is dead — reset and re-initialize
    window.__linkedinHunterLoaded = false;
  }
  window.__linkedinHunterLoaded = true;

  // ==================== CLEANUP STALE EXTENSION ARTIFACTS ====================
  // Remove any <link> or <style> tags from previous extension loads that now
  // point to chrome-extension://invalid/ and cause network errors
  document.querySelectorAll('link[href*="chrome-extension://"]').forEach(link => {
    try {
      const url = new URL(link.href);
      // Check if the extension ID in the URL matches a valid, reachable extension
      // If it contains "invalid" or if we can't verify it, remove it
      if (link.href.includes('chrome-extension://invalid/') ||
          link.href.includes('content-script.css')) {
        link.remove();
      }
    } catch { link.remove(); }
  });

  // ==================== INLINE CSS ====================
  // Injected programmatically — never via manifest <link> tags
  const style = document.createElement('style');
  style.id = 'linkedin-hunter-styles';
  // Remove any previous instance's style tag
  document.getElementById('linkedin-hunter-styles')?.remove();
  style.textContent = `
    .lh-highlight {
      outline: 2px solid #0077b5 !important;
      outline-offset: 2px;
      transition: outline 0.2s ease;
      box-shadow: 0 0 8px rgba(0, 119, 181, 0.3);
    }
    .lh-highlight-success {
      outline: 2px solid #22c55e !important;
      outline-offset: 2px;
    }
    .lh-highlight-error {
      outline: 2px solid #ef4444 !important;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);

  // ==================== SUPPRESS STALE EXTENSION FETCH ERRORS ====================
  // When extensions reload, Chrome leaves orphaned references that cause
  // repeated fetch('chrome-extension://invalid/') calls from LinkedIn's JS.
  // Intercept these and return empty responses instead of network errors.
  const _originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0]?.url || args[0];
    if (typeof url === 'string' && url.startsWith('chrome-extension://invalid')) {
      // Silently return an empty response instead of a network error
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return _originalFetch.apply(this, args);
  };

  // ==================== STEALTH MODE ====================
  // Override navigator properties that LinkedIn checks for bot detection
  try {
    // Hide webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Ensure plugins array looks normal
    if (navigator.plugins.length === 0) {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5] // fake non-empty plugins
      });
    }

    // Ensure languages are set
    if (!navigator.languages || navigator.languages.length === 0) {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    }

    // Add chrome runtime property if missing (headless detection)
    if (!window.chrome?.runtime) {
      // Already in extension context, should be fine
    }
  } catch (e) {
    // Stealth patches are best-effort
  }

  // Human-like delays with jitter
  function humanDelay(base = 200) {
    return base + Math.random() * base * 0.8;
  }

  // Human-like mouse movement simulation with hover
  function simulateHumanClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  }

  // Async version with hover delay for important clicks (Easy Apply, Submit, Next)
  async function simulateHumanClickWithHover(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
    await sleep(100 + Math.random() * 200);
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    await sleep(50 + Math.random() * 80);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  }

  // Human-like typing with variable speed
  async function humanType(el, text) {
    el.focus();
    el.value = '';
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));

    for (const char of text) {
      el.value += char;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
      // Variable typing speed: 30-80ms per char with occasional pauses
      const delay = Math.random() < 0.1 ? (200 + Math.random() * 300) : (30 + Math.random() * 50);
      await sleep(delay);
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // ==================== EASY APPLY DETECTION ====================

  function findEasyApplyButton() {
    // Method 1: CSS selectors
    let btn = document.querySelector(SELECTORS.easyApplyButton) || deepQuerySelector(document, SELECTORS.easyApplyButton);
    if (btn) return btn;

    // Method 2: scan all buttons by innerText
    const allButtons = document.querySelectorAll('button');
    for (const b of allButtons) {
      const text = (b.innerText || b.textContent || '').trim().toLowerCase();
      if (text.includes('easy apply')) return b;
    }

    // Method 3: aria-label
    const ariaButtons = document.querySelectorAll('button[aria-label]');
    for (const b of ariaButtons) {
      const label = b.getAttribute('aria-label').toLowerCase();
      if (label.includes('easy apply')) return b;
    }

    // Method 4: find span with "Easy Apply" and walk up to button
    const spans = document.querySelectorAll('span');
    for (const span of spans) {
      if ((span.innerText || '').trim().toLowerCase() === 'easy apply') {
        const parent = span.closest('button') || span.closest('a');
        if (parent) return parent;
      }
    }

    return null;
  }

  function hasEasyApplyOnPage() {
    return !!findEasyApplyButton() || (document.body.innerText || '').includes('Easy Apply');
  }

  // Find the actual Easy Apply modal (not Premium upsell or other dialogs)
  function findEasyApplyModal() {
    // Method 1: Specific Easy Apply selectors
    const specificSelectors = [
      'div.jobs-easy-apply-modal',
      'div[data-test-modal-id="easy-apply-modal"]',
      '.artdeco-modal.jobs-easy-apply-modal',
      'div[role="dialog"][class*="easy-apply"]'
    ];
    for (const sel of specificSelectors) {
      const el = document.querySelector(sel) || deepQuerySelector(document, sel);
      if (el && el.offsetParent !== null) return el;
    }

    // Method 2: Find any visible dialog that contains form elements AND
    // has "Easy Apply" or application-related text (not Premium upsell)
    const allDialogs = document.querySelectorAll('div[role="dialog"].artdeco-modal, div.artdeco-modal--layer-default');
    for (const dialog of allDialogs) {
      if (dialog.offsetParent === null) continue;
      const text = (dialog.textContent || '').toLowerCase();
      const hasFormElements = dialog.querySelector('input, select, textarea, .fb-dash-form-element');
      const hasApplyIndicator = text.includes('easy apply') || text.includes('submit application')
        || text.includes('contact info') || text.includes('resume')
        || text.includes('work experience') || text.includes('education')
        || dialog.querySelector('h2[id*="easy-apply"], [class*="easy-apply"]');
      const isPremiumUpsell = text.includes('try premium') || text.includes('get premium')
        || text.includes('subscription') || text.includes('free trial')
        || text.includes('upgrade to premium');

      if (!isPremiumUpsell && (hasFormElements || hasApplyIndicator)) {
        return dialog;
      }
    }

    return null;
  }

  // ==================== SHADOW DOM PIERCING ====================

  // Recursively search through Shadow DOM trees
  function deepQuerySelector(root, selector) {
    // Try normal query first
    let result = root.querySelector(selector);
    if (result) return result;

    // Search shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        result = deepQuerySelector(el.shadowRoot, selector);
        if (result) return result;
      }
    }
    return null;
  }

  function deepQuerySelectorAll(root, selector) {
    const results = Array.from(root.querySelectorAll(selector));

    // Search shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        results.push(...deepQuerySelectorAll(el.shadowRoot, selector));
      }
    }
    return results;
  }

  // Find elements by text content (useful when classes are obfuscated)
  function findElementsByText(text, tag = '*') {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (tag !== '*' && node.tagName.toLowerCase() !== tag.toLowerCase()) return NodeFilter.FILTER_SKIP;
          // Check direct text content (not children's text)
          const directText = Array.from(node.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .join(' ');
          if (directText.toLowerCase().includes(text.toLowerCase())) return NodeFilter.FILTER_ACCEPT;
          // Also check innerText for simple elements
          if (node.children.length <= 2 && node.innerText?.toLowerCase().includes(text.toLowerCase())) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    while (walker.nextNode()) results.push(walker.currentNode);
    return results;
  }

  // ==================== DOM ANALYZER ====================
  const SELECTORS = {
    jobList: [
      'ul.scaffold-layout__list-container',
      'div.scaffold-layout__list ul',
      '.jobs-search-results-list ul',
      '.jobs-search-results__list',
      '.scaffold-layout__list',
      'ul.jobs-search__results-list'
    ].join(', '),

    jobCard: [
      'li[data-occludable-job-id]',
      'li.jobs-search-results__list-item',
      'li.ember-view.occludable-update',
      '.job-card-container',
      '.job-card-list',
      'li[id^="ember"]',
      '.scaffold-layout__list-item'
    ].join(', '),

    jobTitle: [
      '.job-card-list__title',
      '.job-card-container__link',
      'a.job-card-list__title--link',
      '.artdeco-entity-lockup__title',
      'a[href*="/jobs/view/"] strong',
      'a[href*="/jobs/view/"] span',
      '.job-card-container__link strong',
      'a.disabled.ember-view',
      '[class*="job-card"] a[href*="/jobs/"]'
    ].join(', '),

    jobCompany: [
      '.job-card-container__primary-description',
      '.artdeco-entity-lockup__subtitle',
      '.job-card-container__company-name',
      '[class*="job-card"] .artdeco-entity-lockup__subtitle',
      '.job-card-list__entity-lockup .artdeco-entity-lockup__subtitle'
    ].join(', '),

    jobLocation: [
      '.job-card-container__metadata-item',
      '.artdeco-entity-lockup__caption',
      '.job-card-container__metadata-wrapper',
      '[class*="job-card"] .artdeco-entity-lockup__caption'
    ].join(', '),

    jobSalary: '.job-card-list__salary-info, .job-card-container__metadata-item--salary',

    easyApplyBadge: [
      '.job-card-container__apply-method',
      'li-icon[type="linkedin-bug"]',
      '.job-card-list__footer-wrapper li-icon[type="linkedin-bug"]',
      '[class*="job-card"] li-icon[type="linkedin-bug"]'
    ].join(', '),

    selectedJob: [
      '.job-card-container--selected',
      '.jobs-search-results-list__list-item--active',
      '.job-card-list--is-active',
      '[class*="job-card"][class*="active"]',
      '[class*="job-card"][class*="selected"]'
    ].join(', '),

    easyApplyButton: [
      'button.jobs-apply-button',
      'button[aria-label*="Easy Apply"]',
      'button[aria-label*="easy apply"]',
      '.jobs-apply-button',
      'button.jobs-apply-button--top-card',
      '.jobs-s-apply button',
      '.jobs-apply-button--top-card',
      'button[class*="jobs-apply-button"]',
      'button[class*="apply-button"]',
      '.job-details-jobs-unified-top-card__content--two-pane button[aria-label*="Apply"]',
      '.jobs-unified-top-card button[aria-label*="Apply"]'
    ].join(', '),

    applyModal: [
      'div.jobs-easy-apply-modal',
      'div[data-test-modal-id="easy-apply-modal"]',
      '.artdeco-modal.jobs-easy-apply-modal',
      'div[role="dialog"][class*="easy-apply"]'
    ].join(', '),

    modalForm: [
      'div.jobs-easy-apply-modal div.fb-dash-form-element',
      'div.jobs-easy-apply-content div.fb-dash-form-element',
      '.artdeco-modal div.fb-dash-form-element',
      'div[role="dialog"] div.fb-dash-form-element'
    ].join(', '),

    nextButton: [
      'div.jobs-easy-apply-modal footer button.artdeco-button--primary',
      'div.artdeco-modal footer button.artdeco-button--primary',
      'footer .artdeco-button--primary',
      'div[role="dialog"] footer button[aria-label*="Submit"]',
      'div[role="dialog"] footer button[aria-label*="Next"]',
      'div[role="dialog"] footer button[aria-label*="Review"]'
    ].join(', '),

    dismissButton: [
      'button[aria-label="Dismiss"]',
      'button[data-test-modal-close-btn]',
      'div.artdeco-modal__dismiss',
      'button.artdeco-modal__dismiss',
      'div[role="dialog"] button[aria-label="Dismiss"]'
    ].join(', '),

    discardButton: [
      'button[data-control-name="discard_application_confirm_btn"]',
      'button.artdeco-modal__confirm-dialog-btn:nth-child(2)',
      'button[data-test-dialog-secondary-btn]'
    ].join(', '),

    followCheckbox: 'label[for*="follow-company"], input[id*="follow-company"]',

    formLabel: '.fb-dash-form-element__label, .artdeco-text-input--label, label',
    textInput: 'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"]',
    textarea: 'textarea',
    select: 'select',
    radio: 'input[type="radio"]',
    checkbox: 'input[type="checkbox"]',
    fileUpload: 'input[type="file"]',

    jobDetailTitle: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '.t-24.job-details-jobs-unified-top-card__job-title',
      'h1.t-24', 'h2.t-24',
      '.jobs-details__main-content h1',
      '.jobs-details__main-content h2'
    ].join(', '),

    jobDetailCompany: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__primary-description-container a',
      '.jobs-details__main-content .artdeco-entity-lockup__subtitle'
    ].join(', '),

    jobDescription: [
      '.jobs-description-content',
      '.jobs-box__html-content',
      '.jobs-description__content',
      '#job-details'
    ].join(', ')
  };

  // ==================== PAGE CONTEXT ====================

  // ==================== UNIVERSAL CAREER PAGE SUPPORT ====================

  // Heuristic field type patterns (based on Firefox autofill + ATS research)
  const FIELD_PATTERNS = {
    firstName:    /first.?name|given.?name|fname|first$/i,
    lastName:     /last.?name|family.?name|lname|surname|last$/i,
    fullName:     /^name$|full.?name|your.?name|candidate.?name|applicant.?name/i,
    email:        /e.?mail|courriel/i,
    phone:        /phone|tel(ephone)?|mobile|cell/i,
    address:      /address|street|addr/i,
    city:         /city|town|locality/i,
    state:        /state|province|region/i,
    zip:          /zip|postal|postcode/i,
    country:      /country|nation/i,
    company:      /company|employer|organization|org$|current.?company/i,
    jobTitle:     /title|position|role|job.?title|current.?title/i,
    linkedin:     /linkedin/i,
    portfolio:    /portfolio|website|url|github|personal.?site/i,
    resume:       /resume|cv|curriculum/i,
    coverLetter:  /cover.?letter|letter.?of|motivation/i,
    school:       /school|university|college|institution/i,
    degree:       /degree|qualification/i,
    major:        /major|field.?of.?study|discipline|concentration/i,
    gpa:          /gpa|grade.?point/i,
    gradYear:     /graduat(ion|e).?year|year.?of.?graduat/i,
    experience:   /years?.?of.?experience|experience.?years|how.?many.?years/i,
    salary:       /salary|compensation|pay|desired.?pay|expected/i,
    startDate:    /start.?date|available|earliest|when.?can.?you/i,
    gender:       /gender|sex$/i,
    ethnicity:    /race|ethnic|heritage/i,
    veteran:      /veteran|military/i,
    disability:   /disab(ility|led)/i,
    authorized:   /authorized|eligible|visa|sponsorship|legally|work.?permit/i,
    relocate:     /relocat|willing.?to.?move/i,
    referral:     /referr|how.?did.?you.?(hear|find|learn)/i,
    source:       /source|where.?did.?you|how.?did.?you/i,
  };

  // ATS URL detection
  const ATS_PATTERNS = {
    greenhouse:      /boards\.greenhouse\.io|job-boards\.greenhouse\.io/i,
    lever:           /jobs\.lever\.co/i,
    workday:         /\.wd\d+\.myworkdayjobs\.com|myworkday\.com/i,
    icims:           /\.icims\.com/i,
    taleo:           /\.taleo\.net|oracle.*cloud.*recruit/i,
    ashby:           /jobs\.ashbyhq\.com/i,
    smartrecruiters: /\.smartrecruiters\.com|jobs\.smartrecruiters/i,
    jobvite:         /\.jobvite\.com/i,
    bamboohr:        /\.bamboohr\.com/i,
    workable:        /apply\.workable\.com|\.workable\.com\/j\//i,
    successfactors:  /\.successfactors\.com|\.successfactors\.eu/i,
    breezy:          /\.breezy\.hr/i,
    recruitee:       /\.recruitee\.com/i,
    jazz:            /\.jazz\.co|\.applytojob\.com|\.resumator\.com/i,
  };

  function detectATS(url) {
    for (const [ats, pattern] of Object.entries(ATS_PATTERNS)) {
      if (pattern.test(url)) return ats;
    }
    return null;
  }

  function isCareerPage() {
    const url = window.location.href;
    if (detectATS(url)) return true;
    const careerKeywords = /career|jobs?\/apply|application|hiring|recruit|talent|position|opening|vacancy/i;
    if (careerKeywords.test(url)) return true;
    const hasApplyForm = !!document.querySelector('form[action*="apply"], form[action*="submit"], form[id*="apply"], form[class*="apply"]');
    const hasResumeUpload = !!document.querySelector('input[type="file"]');
    const bodyText = (document.body?.innerText || '').slice(0, 5000).toLowerCase();
    const hasCareerText = bodyText.includes('apply for this') || bodyText.includes('submit your application')
      || bodyText.includes('upload your resume') || bodyText.includes('apply now');
    return hasApplyForm || (hasResumeUpload && hasCareerText);
  }

  function detectFieldType(element) {
    const autocomplete = element.getAttribute('autocomplete') || '';
    const autoMap = {
      'given-name': 'firstName', 'family-name': 'lastName', 'name': 'fullName',
      'email': 'email', 'tel': 'phone', 'street-address': 'address',
      'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'zip',
      'country-name': 'country', 'organization': 'company', 'url': 'portfolio'
    };
    if (autoMap[autocomplete]) return autoMap[autocomplete];
    if (element.type === 'email') return 'email';
    if (element.type === 'tel') return 'phone';
    if (element.type === 'file') return 'resume';

    const signals = [
      element.name || '', element.id || '', element.placeholder || '',
      element.getAttribute('aria-label') || '',
      getUniversalLabel(element)
    ].join(' ');

    for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(signals)) return fieldType;
    }
    return 'unknown';
  }

  function getUniversalLabel(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) return label.textContent.trim();
    }
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    let el = input.parentElement;
    for (let i = 0; i < 5 && el; i++) {
      const label = el.querySelector('label');
      if (label && label !== input) return label.textContent.trim();
      el = el.parentElement;
    }
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const refEl = document.getElementById(labelledBy);
      if (refEl) return refEl.textContent.trim();
    }
    return '';
  }

  function extractUniversalFormContext() {
    const url = window.location.href;
    const ats = detectATS(url);
    const ctx = {
      isCareerPage: true,
      ats: ats || 'generic',
      pageTitle: document.title,
    };

    // Detect login page
    const bodyText = (document.body?.innerText || '').slice(0, 3000).toLowerCase();
    ctx.isLoginPage = !!(document.querySelector('input[type="password"]'))
      && (bodyText.includes('sign in') || bodyText.includes('log in') || bodyText.includes('create account'));

    // Detect Google sign-in
    ctx.hasGoogleSignIn = !!(
      document.querySelector('.g_id_signin, [class*="g_id_signin"]')
      || document.querySelector('iframe[src*="accounts.google.com"]')
      || document.querySelector('[data-onsuccess], .abcRioButton')
      || Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"]')).find(el => {
        const text = ((el.textContent || '') + ' ' + (el.className || '')).toLowerCase();
        return text.includes('google') && (text.includes('sign') || text.includes('log') || text.includes('continue'));
      })
    );

    // Detect social sign-in buttons
    ctx.socialSignIn = [];
    const socialBtns = document.querySelectorAll('button, a[role="button"], div[role="button"], a[href*="oauth"], a[href*="auth"]');
    for (const btn of socialBtns) {
      if (!btn.offsetParent) continue;
      const text = ((btn.textContent || '') + ' ' + (btn.className || '')).toLowerCase();
      if (text.includes('google') && (text.includes('sign') || text.includes('log') || text.includes('continue')))
        ctx.socialSignIn.push({ provider: 'google', selector: buildSelector(btn) });
      if (text.includes('linkedin') && (text.includes('sign') || text.includes('log') || text.includes('continue')))
        ctx.socialSignIn.push({ provider: 'linkedin', selector: buildSelector(btn) });
    }

    // Detect Apply button
    for (const btn of document.querySelectorAll('a, button')) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if ((text === 'apply' || text === 'apply now' || text === 'apply for this job') && btn.offsetParent) {
        ctx.hasApplyButton = true;
        ctx.applyButtonSelector = buildSelector(btn);
        break;
      }
    }

    // Confirmation page
    ctx.isConfirmationPage = bodyText.includes('application submitted') || bodyText.includes('thank you for applying')
      || bodyText.includes('your application has been') || bodyText.includes('successfully submitted');

    // Errors
    const errorEls = document.querySelectorAll('[class*="error"]:not(script):not(style), [role="alert"], [aria-invalid="true"]');
    ctx.errors = Array.from(errorEls).map(e => e.textContent.trim()).filter(t => t.length > 0 && t.length < 200).slice(0, 10);

    // Submit/Next button
    for (const btn of document.querySelectorAll('button[type="submit"], input[type="submit"], button')) {
      const text = (btn.textContent || btn.value || '').trim().toLowerCase();
      if ((text.includes('submit') || text.includes('next') || text.includes('continue') || text.includes('save')) && btn.offsetParent) {
        ctx.hasNextButton = true;
        ctx.nextButtonText = text;
        ctx.nextButtonSelector = buildSelector(btn);
        break;
      }
    }

    // Form fields with heuristic detection
    ctx.fields = extractUniversalFields();
    ctx.hasFileUpload = !!document.querySelector('input[type="file"]');

    return ctx;
  }

  function extractUniversalFields() {
    const fields = [];
    const seen = new Set();

    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
    );

    for (const inp of inputs) {
      if (!inp.offsetParent) continue;
      const sel = buildSelector(inp);
      if (seen.has(sel)) continue;
      seen.add(sel);

      const label = getUniversalLabel(inp) || inp.placeholder || inp.name || '';
      const fieldType = detectFieldType(inp);
      const tag = inp.tagName.toLowerCase();

      const field = {
        index: fields.length,
        type: tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : (inp.type || 'text'),
        label: label.replace(/\*\s*$/, '').trim(),
        value: inp.type === 'checkbox' ? (inp.checked ? 'true' : '') : (inp.value || ''),
        required: inp.required || inp.getAttribute('aria-required') === 'true',
        selector: sel,
        detectedType: fieldType,
      };

      if (tag === 'select') {
        field.options = Array.from(inp.options).map(o => ({ value: o.value, text: o.textContent.trim() }));
      }

      fields.push(field);
    }

    // Custom dropdowns
    document.querySelectorAll('button[aria-haspopup="listbox"], div[role="combobox"], input[role="combobox"]').forEach(dd => {
      if (!dd.offsetParent) return;
      const sel = buildSelector(dd);
      if (seen.has(sel)) return;
      seen.add(sel);
      fields.push({
        index: fields.length, type: 'dropdown',
        label: (getUniversalLabel(dd) || dd.getAttribute('aria-label') || '').replace(/\*\s*$/, '').trim(),
        value: dd.textContent?.trim() || '',
        required: dd.getAttribute('aria-required') === 'true',
        selector: sel, detectedType: detectFieldType(dd),
      });
    });

    // Radio groups
    const radioGroups = {};
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      if (!radio.offsetParent) return;
      const name = radio.name || radio.id;
      if (!radioGroups[name]) radioGroups[name] = { element: radio, options: [] };
      const lbl = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
      radioGroups[name].options.push({ text: lbl?.textContent?.trim() || radio.value, value: radio.value, checked: radio.checked, id: radio.id });
    });
    for (const [name, group] of Object.entries(radioGroups)) {
      const container = group.element.closest('fieldset') || group.element.closest('[role="radiogroup"]') || group.element.parentElement?.parentElement;
      const legend = container?.querySelector('legend, label')?.textContent?.trim() || name;
      fields.push({
        index: fields.length, type: 'radio', label: legend,
        options: group.options, value: group.options.find(o => o.checked)?.text || '',
        required: group.element.required, selector: buildSelector(group.element), detectedType: detectFieldType(group.element),
      });
    }

    return fields;
  }

  // ==================== WORKDAY SUPPORT ====================

  function extractWorkdayContext() {
    if (!isWorkdayPage()) return null;

    const ctx = { isWorkday: true };

    // Detect current page/step title
    const titleSelectors = [
      '[data-automation-id="pageHeaderTitle"]',
      'h2[data-automation-id="pageTitle"]',
      'h2', 'h1'
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        ctx.pageTitle = el.textContent.trim();
        break;
      }
    }

    // Detect login page
    const loginIndicators = [
      'input[data-automation-id="email"]',
      'input[type="password"]',
      'button[data-automation-id="signInButton"]',
      '[data-automation-id="createAccountLink"]'
    ];
    ctx.isLoginPage = loginIndicators.some(s => document.querySelector(s));

    // Detect Apply button
    const applyBtn = document.querySelector('a[data-automation-id="jobPostingApplyButton"], button[data-automation-id="jobPostingApplyButton"]');
    ctx.hasApplyButton = !!applyBtn;

    // Detect Submit button
    const submitBtn = document.querySelector('button[data-automation-id="bottom-navigation-next-button"]');
    ctx.hasNextButton = !!submitBtn;
    if (submitBtn) {
      ctx.nextButtonText = submitBtn.textContent.trim();
    }

    // Detect error messages
    const errors = document.querySelectorAll('[data-automation-id="errorMessage"], [data-automation-id="fieldErrorMessage"], [aria-live="assertive"][role="alert"]');
    ctx.errors = Array.from(errors).map(e => e.textContent.trim()).filter(Boolean);

    // Extract form fields
    ctx.fields = extractWorkdayFields();

    // File upload present?
    ctx.hasFileUpload = !!document.querySelector('input[type="file"]');

    // Check if a file is already uploaded
    const uploadedFile = document.querySelector('[data-automation-id="file-upload-item"]');
    if (uploadedFile) {
      ctx.uploadedFileName = uploadedFile.textContent.trim();
    }

    // Detect if this is a job posting page (not application form)
    ctx.isJobPostingPage = ctx.hasApplyButton && ctx.fields.length === 0;

    // Detect confirmation/thank you page
    const bodyText = (document.body.innerText || '').toLowerCase();
    ctx.isConfirmationPage = [
      'application submitted', 'thank you for applying', 'your application has been',
      'application received', 'successfully submitted', 'thank you for your interest'
    ].some(k => bodyText.includes(k));

    // Detect session timeout / expired
    ctx.isSessionExpired = bodyText.includes('session has expired') || bodyText.includes('session timed out')
      || bodyText.includes('please sign in again') || bodyText.includes('your session has ended');

    // Detect OK/confirm modal (Workday sometimes shows confirmation dialogs)
    const okBtn = document.querySelector('button[data-automation-id="wd-CommandButton_uic_okButton"]');
    ctx.hasOkModal = !!okBtn;

    // Detect "Already Applied" state
    ctx.alreadyApplied = bodyText.includes('you have already applied') || bodyText.includes('already submitted');

    // Tab navigation (Workday wizard tabs like "My Information", "My Experience", etc.)
    const tabs = document.querySelectorAll('[data-automation-id="tabLabel"]');
    if (tabs.length > 0) {
      ctx.wizardTabs = Array.from(tabs).map(t => ({
        label: t.textContent.trim(),
        active: t.getAttribute('aria-selected') === 'true' || t.classList.contains('css-1ew3jbz')
      }));
    }

    return ctx;
  }

  function extractWorkdayFields() {
    const fields = [];

    // Text inputs
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"]').forEach((inp, i) => {
      if (!inp.offsetParent) return; // hidden
      const label = getWorkdayLabel(inp);
      const autoId = inp.closest('[data-automation-id]')?.getAttribute('data-automation-id') || '';
      fields.push({
        index: i, type: 'text', label,
        value: inp.value || '',
        required: inp.required || inp.getAttribute('aria-required') === 'true',
        selector: buildSelector(inp),
        automationId: autoId
      });
    });

    // Textareas
    document.querySelectorAll('textarea').forEach((ta, i) => {
      if (!ta.offsetParent) return;
      const label = getWorkdayLabel(ta);
      fields.push({
        index: fields.length, type: 'textarea', label,
        value: ta.value || '',
        required: ta.required || ta.getAttribute('aria-required') === 'true',
        selector: buildSelector(ta)
      });
    });

    // Native selects
    document.querySelectorAll('select').forEach((sel, i) => {
      if (!sel.offsetParent) return;
      const label = getWorkdayLabel(sel);
      const options = Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent.trim() }));
      fields.push({
        index: fields.length, type: 'select', label, options,
        value: sel.value || '',
        required: sel.required || sel.getAttribute('aria-required') === 'true',
        selector: buildSelector(sel)
      });
    });

    // Workday React dropdowns (custom combobox)
    document.querySelectorAll('button[aria-haspopup="listbox"], div[role="combobox"], input[role="combobox"]').forEach((dd, i) => {
      if (!dd.offsetParent) return;
      const label = getWorkdayLabel(dd);
      // Get current selected value
      const container = dd.closest('[data-automation-id]') || dd.parentElement;
      const selectedEl = container?.querySelector('[data-automation-id="selectedItem"], [data-automation-id="promptValue"]');
      const currentValue = selectedEl?.textContent?.trim() || '';
      fields.push({
        index: fields.length, type: 'dropdown', label,
        value: currentValue,
        required: dd.getAttribute('aria-required') === 'true',
        selector: buildSelector(dd),
        automationId: container?.getAttribute('data-automation-id') || ''
      });
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
      if (!cb.offsetParent) return;
      const label = getWorkdayLabel(cb);
      fields.push({
        index: fields.length, type: 'checkbox', label,
        value: cb.checked ? 'true' : '',
        required: cb.required,
        selector: buildSelector(cb)
      });
    });

    // Radio buttons (group by name)
    const radioGroups = {};
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      if (!radio.offsetParent) return;
      const name = radio.name || radio.id;
      if (!radioGroups[name]) {
        radioGroups[name] = { element: radio, options: [] };
      }
      const lbl = document.querySelector(`label[for="${radio.id}"]`);
      radioGroups[name].options.push({
        text: lbl?.textContent?.trim() || radio.value,
        value: radio.value,
        checked: radio.checked,
        id: radio.id
      });
    });
    for (const [name, group] of Object.entries(radioGroups)) {
      const container = group.element.closest('fieldset') || group.element.closest('[role="radiogroup"]') || group.element.parentElement?.parentElement;
      const legend = container?.querySelector('legend, label')?.textContent?.trim() || name;
      fields.push({
        index: fields.length, type: 'radio', label: legend,
        options: group.options,
        value: group.options.find(o => o.checked)?.text || '',
        required: group.element.required,
        selector: buildSelector(group.element)
      });
    }

    return fields;
  }

  function getWorkdayLabel(input) {
    // Try aria-label
    const aria = input.getAttribute('aria-label');
    if (aria) return aria.trim();

    // Try label[for=id]
    const id = input.id;
    if (id) {
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl) return lbl.textContent.replace(/\*\s*$/, '').trim();
    }

    // Try closest label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.replace(/\*\s*$/, '').trim();

    // Try Workday's data-automation-id label
    const container = input.closest('[data-automation-id]');
    if (container) {
      const formLabel = container.querySelector('[data-automation-id="formLabel"], label');
      if (formLabel) return formLabel.textContent.replace(/\*\s*$/, '').trim();
    }

    // Try placeholder
    return input.placeholder || input.name || '';
  }

  // Fill a Workday React text field properly (triggers onChange + onBlur)
  async function fillWorkdayTextField(input, value) {
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('focus', { bubbles: true }));

    // Use native input value setter to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(200);
  }

  // Fill a Workday dropdown (click -> type to filter -> select)
  async function fillWorkdayDropdown(trigger, value) {
    // Click to open
    simulateHumanClick(trigger);
    await sleep(600);

    // Find search input
    const searchBox = document.querySelector('input[data-automation-id="searchBox"], input[role="combobox"]');
    if (searchBox) {
      await humanType(searchBox, value);
      await sleep(800);
    }

    // Find and click matching option
    const options = document.querySelectorAll('div[data-automation-id="promptOption"], li[role="option"], div[role="option"]');
    let selected = false;
    const valLower = value.toLowerCase();

    // Exact match first
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase() === valLower) {
        simulateHumanClick(opt);
        selected = true;
        break;
      }
    }
    // Partial match
    if (!selected) {
      for (const opt of options) {
        const optText = opt.textContent.trim().toLowerCase();
        if (optText.includes(valLower) || valLower.includes(optText)) {
          simulateHumanClick(opt);
          selected = true;
          break;
        }
      }
    }
    // First option fallback
    if (!selected && options.length > 0) {
      simulateHumanClick(options[0]);
      selected = true;
    }

    await sleep(300);
    // Close dropdown
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return selected;
  }

  function getFullContext() {
    const pageType = detectPageType();
    const isLinkedin = pageType.startsWith('job_') || pageType === 'jobs_home' || pageType === 'linkedin_other';
    const isWd = pageType === 'workday';
    const isCareer = pageType === 'career_page';

    const ctx = {
      url: window.location.href,
      pageType,
      jobs: isLinkedin ? extractJobs() : [],
      selectedJob: isLinkedin ? extractSelectedJob() : null,
      jobDetail: isLinkedin ? extractJobDetail() : null,
      modal: isLinkedin ? extractModal() : null,
    };

    // Add Workday context if on a Workday page
    if (isWd) {
      ctx.workday = extractWorkdayContext();
    }

    // Add universal career page context for any non-LinkedIn, non-Workday career page
    if (isCareer) {
      ctx.careerPage = extractUniversalFormContext();
    }

    // Include cached field defaults so Claude can auto-fill known fields
    if (modalCache?.fieldDefaults && Object.keys(modalCache.fieldDefaults).length > 0) {
      ctx.cachedFieldDefaults = {};
      for (const [key, entry] of Object.entries(modalCache.fieldDefaults)) {
        ctx.cachedFieldDefaults[key] = entry.value;
      }
    }

    // Debug info
    if (isLinkedin) {
      const jobLinksNormal = document.querySelectorAll('a[href*="/jobs/view/"]');
      const jobLinksDeep = deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]');
      ctx._debug = {
        jobCardsBySelector: document.querySelectorAll(SELECTORS.jobCard).length,
        jobLinksNormal: jobLinksNormal.length,
        jobLinksDeep: jobLinksDeep.length,
        hasJobList: !!document.querySelector(SELECTORS.jobList),
        hasScaffoldList: !!document.querySelector('.scaffold-layout__list'),
        hasEasyApplyBtn: hasEasyApplyOnPage(),
        hasModal: !!findEasyApplyModal(),
        extractedJobCount: ctx.jobs.length,
        pageTitle: document.title,
        cachedPatterns: Object.keys(modalCache?.patterns || {}).length,
        cachedFieldDefaults: Object.keys(modalCache?.fieldDefaults || {}).length
      };
    }

    return ctx;
  }

  function detectPageType() {
    const url = window.location.href;
    // Workday
    if (url.match(/\.wd\d+\.myworkdayjobs\.com/)) return 'workday';
    if (url.includes('myworkday.com')) return 'workday';
    // LinkedIn
    if (url.includes('linkedin.com')) {
      if (url.includes('/jobs/search')) return 'job_search';
      if (url.includes('/jobs/collections')) return 'job_collections';
      if (url.includes('/jobs/view')) return 'job_view';
      if (url.includes('/jobs')) return 'jobs_home';
      return 'linkedin_other';
    }
    // Known ATS or heuristic career page detection
    if (detectATS(url) || isCareerPage()) return 'career_page';
    return 'other';
  }

  function isWorkdayPage() {
    return detectPageType() === 'workday';
  }

  function extractJobs() {
    const jobs = [];
    let cards = [];

    // Approach 1: Known selectors (normal DOM)
    cards = Array.from(document.querySelectorAll(SELECTORS.jobCard));

    // Approach 2: Deep query through Shadow DOM
    if (cards.length === 0) {
      cards = deepQuerySelectorAll(document, SELECTORS.jobCard);
    }

    // Approach 3: Find by job links (normal) → walk up
    if (cards.length === 0) {
      const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
      const seen = new Set();
      jobLinks.forEach(a => {
        const card = a.closest('li')
          || a.closest('[data-occludable-job-id]')
          || a.closest('[class*="job-card"]')
          || a.closest('[class*="jobs-search"]')
          || a.closest('div[class*="occludable"]')
          || a.parentElement?.parentElement;
        if (card && !seen.has(card)) {
          seen.add(card);
          cards.push(card);
        }
      });
    }

    // Approach 4: Deep query job links through Shadow DOM → walk up
    if (cards.length === 0) {
      const deepLinks = deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]');
      const seen = new Set();
      deepLinks.forEach(a => {
        const card = a.closest('li')
          || a.closest('[data-occludable-job-id]')
          || a.closest('[class*="job-card"]')
          || a.parentElement?.parentElement;
        if (card && !seen.has(card)) {
          seen.add(card);
          cards.push(card);
        }
      });
    }

    // Approach 5: Data attributes
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('[data-occludable-job-id]'));
    }
    if (cards.length === 0) {
      cards = deepQuerySelectorAll(document, '[data-occludable-job-id]');
    }

    // Approach 6: Scaffold layout
    if (cards.length === 0) {
      const scaffoldList = document.querySelector('.scaffold-layout__list') || deepQuerySelector(document, '.scaffold-layout__list');
      if (scaffoldList) {
        const ul = scaffoldList.querySelector('ul');
        if (ul) {
          cards = Array.from(ul.children);
        } else {
          cards = Array.from(scaffoldList.children).filter(
            c => c.querySelector('a[href*="/jobs/"]') || deepQuerySelector(c, 'a[href*="/jobs/"]')
          );
        }
      }
    }

    // Approach 7: Nuclear - find ALL links to /jobs/view/ and deduplicate
    if (cards.length === 0) {
      const links = deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]');
      const byId = new Map();
      links.forEach(a => {
        const match = a.href.match(/\/jobs\/view\/(\d+)/);
        if (match && !byId.has(match[1])) {
          byId.set(match[1], a);
        }
      });
      cards = Array.from(byId.values());
    }

    // Approach 8: Text-based fallback - find elements containing job-like text patterns
    if (cards.length === 0) {
      // Look for list items in main content area that have substantial text
      const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      const listItems = main.querySelectorAll('li');
      const jobLikeItems = Array.from(listItems).filter(li => {
        const text = li.textContent || '';
        // A job card typically has: company name, location, and "Easy Apply" or "Applied" or a date
        return text.length > 50 && text.length < 2000 &&
          (text.includes('Easy Apply') || text.includes('Applied') || text.includes('Promoted') ||
           /\d+\s*(hour|day|week|month)s?\s*ago/i.test(text)) &&
          li.querySelector('a');
      });
      if (jobLikeItems.length > 0) {
        cards = jobLikeItems;
      }
    }

    console.log(`[AP] extractJobs: found ${cards.length} cards`);

    cards.forEach((card, index) => {
      try {
        const jobLink = card.tagName === 'A' && card.href?.includes('/jobs/view/')
          ? card
          : (card.querySelector('a[href*="/jobs/view/"]') || deepQuerySelector(card, 'a[href*="/jobs/view/"]'));

        const linkedinId = card.getAttribute('data-occludable-job-id')
          || card.getAttribute('data-job-id')
          || jobLink?.href?.match(/\/jobs\/view\/(\d+)/)?.[1]
          || null;

        let title = '';
        const titleEl = card.querySelector(SELECTORS.jobTitle) || deepQuerySelector(card, SELECTORS.jobTitle);
        if (titleEl) {
          title = titleEl.textContent.trim();
        } else if (jobLink) {
          const strong = jobLink.querySelector('strong');
          const span = jobLink.querySelector('span[aria-hidden="true"]') || jobLink.querySelector('span');
          title = strong?.textContent?.trim() || span?.textContent?.trim() || jobLink.textContent?.trim() || '';
        }

        let company = '';
        const companyEl = card.querySelector(SELECTORS.jobCompany) || deepQuerySelector(card, SELECTORS.jobCompany);
        if (companyEl) {
          company = companyEl.textContent.trim();
        } else {
          const candidates = card.querySelectorAll('[class*="company"], [class*="subtitle"], [class*="primary-description"]');
          if (candidates.length > 0) {
            company = candidates[0].textContent.trim();
          } else {
            const allText = card.textContent.replace(/\s+/g, ' ').trim();
            const lines = allText.split(/\n|·|•/).map(l => l.trim()).filter(l => l.length > 1);
            if (lines.length >= 2) company = lines[1];
          }
        }

        let location = '';
        const locationEl = card.querySelector(SELECTORS.jobLocation) || deepQuerySelector(card, SELECTORS.jobLocation);
        if (locationEl) {
          location = locationEl.textContent.trim();
        } else {
          const text = card.textContent;
          const locMatch = text.match(/(?:Remote|On-site|Hybrid|[\w\s]+,\s*[\w\s]+\s*\([\w-]+\))/i);
          if (locMatch) location = locMatch[0].trim();
        }

        const easyApply = !!(
          card.querySelector(SELECTORS.easyApplyBadge)
          || deepQuerySelector(card, 'li-icon[type="linkedin-bug"]')
          || card.textContent?.includes('Easy Apply')
        );

        const isSelected = matchesAny(card, SELECTORS.selectedJob)
          || card.querySelector('[class*="active"]') !== null
          || card.querySelector('[class*="selected"]') !== null;

        if (!title && !company && !linkedinId) return;

        title = title.replace(/with verification/gi, '').trim();

        jobs.push({
          index,
          linkedinId: linkedinId?.trim() || null,
          title: title || 'Unknown',
          company: company.slice(0, 100) || 'Unknown',
          location: location.slice(0, 100),
          salary: (card.querySelector(SELECTORS.jobSalary) || deepQuerySelector(card, SELECTORS.jobSalary))?.textContent?.trim() || '',
          easyApply,
          isSelected,
          selector: linkedinId
            ? `li[data-occludable-job-id="${linkedinId}"]`
            : buildSelectorForEl(card)
        });
      } catch { /* skip */ }
    });

    return jobs;
  }

  function extractSelectedJob() {
    const sel = document.querySelector(SELECTORS.selectedJob) || deepQuerySelector(document, SELECTORS.selectedJob);
    if (!sel) return null;
    const titleEl = sel.querySelector(SELECTORS.jobTitle) || sel.querySelector('a[href*="/jobs/view/"] strong');
    const companyEl = sel.querySelector(SELECTORS.jobCompany);
    return {
      title: titleEl?.textContent?.trim() || 'Unknown',
      company: companyEl?.textContent?.trim() || 'Unknown',
      linkedinId: sel.getAttribute('data-occludable-job-id')?.trim()
    };
  }

  function extractJobDetail() {
    const titleEl = document.querySelector(SELECTORS.jobDetailTitle) || deepQuerySelector(document, SELECTORS.jobDetailTitle);
    const companyEl = document.querySelector(SELECTORS.jobDetailCompany) || deepQuerySelector(document, SELECTORS.jobDetailCompany);
    const descEl = document.querySelector(SELECTORS.jobDescription) || deepQuerySelector(document, SELECTORS.jobDescription);

    if (!titleEl && !companyEl) {
      const rightPane = document.querySelector('.scaffold-layout__detail, .jobs-search__job-details, .job-view-layout')
        || deepQuerySelector(document, '.scaffold-layout__detail');
      if (rightPane) {
        const h1 = rightPane.querySelector('h1, h2');
        const link = rightPane.querySelector('a[href*="/company/"]');
        if (h1 || link) {
          return {
            title: h1?.textContent?.trim() || '',
            company: link?.textContent?.trim() || '',
            description: rightPane.querySelector('[class*="description"]')?.textContent?.trim()?.slice(0, 2000) || '',
            hasEasyApply: hasEasyApplyOnPage()
          };
        }
      }
      return null;
    }

    return {
      title: titleEl?.textContent?.trim() || '',
      company: companyEl?.textContent?.trim() || '',
      description: descEl?.textContent?.trim()?.slice(0, 2000) || '',
      hasEasyApply: hasEasyApplyOnPage()
    };
  }

  function extractModal() {
    const modal = findEasyApplyModal();
    if (!modal) return null;

    const fields = [];
    const formElements = modal.querySelectorAll(SELECTORS.modalForm);
    const deepFormElements = formElements.length > 0 ? formElements : deepQuerySelectorAll(modal, SELECTORS.modalForm);
    deepFormElements.forEach((group, i) => {
      const field = extractFormField(group, i);
      if (field) fields.push(field);
    });

    if (fields.length === 0) {
      modal.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea').forEach((input, i) => {
        const label = findLabelForInput(input);
        fields.push({
          index: i,
          type: getFieldType(input),
          label: label || input.placeholder || input.name || `field_${i}`,
          required: input.required,
          value: input.value || '',
          options: input.tagName.toLowerCase() === 'select'
            ? Array.from(input.options).map(o => ({ value: o.value, text: o.textContent.trim() }))
            : [],
          selector: buildSelector(input)
        });
      });
    }

    const fileInput = modal.querySelector(SELECTORS.fileUpload);
    if (fileInput && !fields.some(f => f.type === 'file')) {
      fields.push({
        index: fields.length, type: 'file', label: 'Resume / CV',
        required: true, value: fileInput.value ? 'File selected' : '',
        selector: buildSelector(fileInput)
      });
    }

    // Detect resume selection screen (LinkedIn shows list of uploaded resumes with radio buttons)
    let resumeScreen = null;
    const resumeItems = modal.querySelectorAll('[class*="resume"], [class*="document"], [data-test-document-row]');
    // Also detect by looking for PDF icons or resume-like cards with radio/selection buttons
    const allCards = modal.querySelectorAll('div[class*="artdeco-list__item"], li[class*="artdeco-list__item"], div[class*="jobs-document-upload"]');
    const resumeCandidates = resumeItems.length > 0 ? resumeItems : allCards;

    if (resumeCandidates.length > 0 || modal.textContent?.includes('Be sure to include an updated resume')) {
      // This is a resume selection screen
      const resumes = [];
      // Find all resume entries — they typically have a label/name and a radio or selection indicator
      const listItems = modal.querySelectorAll('div[class*="list__item"], li, [class*="document-upload-redesign"]');
      for (const item of listItems) {
        const text = (item.textContent || '').trim();
        if (text.includes('.pdf') || text.includes('.doc') || text.includes('.PDF') || text.includes('.DOC')) {
          const radio = item.querySelector('input[type="radio"]') || item.querySelector('button[role="radio"]');
          const isSelected = radio ? (radio.checked || radio.getAttribute('aria-checked') === 'true')
            : item.querySelector('[class*="selected"], [aria-checked="true"], [data-test-selected]') !== null
              || item.querySelector('svg[class*="selected"], circle[fill]') !== null;
          // Try to find the clickable element
          const clickTarget = radio || item.querySelector('button') || item;
          resumes.push({
            name: text.replace(/\s+/g, ' ').slice(0, 100),
            isSelected,
            selector: buildSelector(clickTarget)
          });
        }
      }

      // If no resumes found via structured parsing, try simpler approach
      if (resumes.length === 0) {
        const buttons = modal.querySelectorAll('button');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim();
          if (text.includes('.pdf') || text.includes('.doc')) {
            resumes.push({
              name: text.replace(/\s+/g, ' ').slice(0, 100),
              isSelected: btn.getAttribute('aria-checked') === 'true' || btn.classList.contains('selected'),
              selector: buildSelector(btn)
            });
          }
        }
      }

      if (resumes.length > 0) {
        resumeScreen = {
          isResumeStep: true,
          resumes,
          hasSelectedResume: resumes.some(r => r.isSelected),
          resumeRequired: modal.textContent?.includes('resume is required') || modal.textContent?.includes('Resume') || false
        };
      }
    }

    const nextBtn = modal.querySelector(SELECTORS.nextButton) || deepQuerySelector(modal, SELECTORS.nextButton);
    const buttonText = nextBtn?.textContent?.trim()?.toLowerCase() || '';

    const result = {
      isOpen: true, fields, buttonText,
      isLastStep: buttonText.includes('submit') || buttonText.includes('review'),
      hasErrors: !!modal.querySelector('.artdeco-inline-feedback--error, .fb-dash-form-element__error-text'),
      errorMessages: Array.from(modal.querySelectorAll('.artdeco-inline-feedback--error')).map(e => e.textContent.trim())
    };

    if (resumeScreen) {
      result.resumeScreen = resumeScreen;
    }

    return result;
  }

  function extractFormField(group, index) {
    const labelEl = group.querySelector(SELECTORS.formLabel) || group.querySelector('label') || group.querySelector('span.t-14');
    let label = labelEl?.textContent?.trim() || '';
    if (label.length > 4) {
      const half = Math.floor(label.length / 2);
      if (label.slice(0, half) === label.slice(half)) label = label.slice(0, half);
    }

    const textInput = group.querySelector(SELECTORS.textInput);
    const textarea = group.querySelector(SELECTORS.textarea);
    const select = group.querySelector(SELECTORS.select);
    const radios = group.querySelectorAll(SELECTORS.radio);
    const checkboxes = group.querySelectorAll(SELECTORS.checkbox);
    const fileInput = group.querySelector(SELECTORS.fileUpload);

    let type, value = '', options = [], selector = '';

    if (select) {
      type = 'select';
      value = select.options[select.selectedIndex]?.textContent?.trim() || select.value;
      options = Array.from(select.options).map(o => ({ value: o.value, text: o.textContent.trim() }));
      selector = buildSelector(select);
    } else if (radios.length > 0) {
      type = 'radio';
      const checked = group.querySelector('input[type="radio"]:checked');
      value = checked ? (checked.closest('label')?.textContent?.trim() || checked.value) : '';
      radios.forEach(r => {
        const rLabel = r.closest('label')?.textContent?.trim() ||
          document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() || r.value;
        options.push({ value: r.value, text: rLabel, id: r.id });
      });
      selector = buildSelector(radios[0]);
    } else if (checkboxes.length > 0) {
      type = 'checkbox';
      value = Array.from(checkboxes).filter(c => c.checked).map(c =>
        c.closest('label')?.textContent?.trim() || c.value
      ).join(', ');
      checkboxes.forEach(c => {
        const cLabel = c.closest('label')?.textContent?.trim() ||
          document.querySelector(`label[for="${c.id}"]`)?.textContent?.trim() || c.value;
        options.push({ value: c.value, text: cLabel, id: c.id });
      });
      selector = buildSelector(checkboxes[0]);
    } else if (textarea) {
      type = 'textarea'; value = textarea.value; selector = buildSelector(textarea);
    } else if (fileInput) {
      type = 'file'; value = fileInput.value ? 'File selected' : ''; selector = buildSelector(fileInput);
    } else if (textInput) {
      type = 'text'; value = textInput.value; selector = buildSelector(textInput);
    } else {
      return null;
    }

    const required = !!(group.querySelector('[required]') || group.querySelector('.required') || label.includes('*'));
    const cleanLabel = label.replace(/\s*\*$/, '');
    const field = { index, type, label: cleanLabel, required, value, options, selector };

    // Attach cached suggestion if field is empty
    if (!value && cleanLabel) {
      const cacheKey = cleanLabel.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (modalCache?.fieldDefaults?.[cacheKey]) {
        field.cachedValue = modalCache.fieldDefaults[cacheKey].value;
      }
    }

    return field;
  }

  function getFieldType(input) {
    const tag = input.tagName.toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    return input.type || 'text';
  }

  function findLabelForInput(input) {
    if (input.id) {
      const lbl = document.querySelector(`label[for="${input.id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parent = input.closest('.fb-dash-form-element, .artdeco-text-input, label');
    if (parent) {
      const lbl = parent.querySelector('label, .fb-dash-form-element__label');
      if (lbl && lbl !== input) return lbl.textContent.trim();
    }
    return input.getAttribute('aria-label') || input.placeholder || '';
  }

  function matchesAny(el, selectorString) {
    try { return el.matches(selectorString); }
    catch { return false; }
  }

  function buildSelectorForEl(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const jobId = el.getAttribute('data-occludable-job-id');
    if (jobId) return `li[data-occludable-job-id="${jobId}"]`;
    return buildSelector(el);
  }

  function buildSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) {
      const tag = el.tagName.toLowerCase();
      const type = el.type ? `[type="${el.type}"]` : '';
      return `${tag}${type}[name="${CSS.escape(el.name)}"]`;
    }
    const path = [];
    let current = el;
    while (current && current !== document.body) {
      let seg = current.tagName.toLowerCase();
      if (current.id) { path.unshift(`#${CSS.escape(current.id)}`); break; }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      path.unshift(seg);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  // ==================== ACTION EXECUTOR ====================

  function highlight(el) {
    el.classList.add('lh-highlight');
    setTimeout(() => el.classList.remove('lh-highlight'), 2000);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Find and click the most recent resume on the resume selection screen
  async function findAndClickResume(modal, preferIndex) {
    // Strategy 1: Find radio buttons or selection indicators next to PDF items
    // LinkedIn uses various patterns - try them all

    // Look for resume list items with clickable elements
    const allItems = modal.querySelectorAll(
      'div[class*="jobs-document-upload-redesign-card"], ' +
      'div[class*="document-upload"], ' +
      'li[class*="artdeco-list__item"], ' +
      'div[class*="artdeco-list__item"]'
    );

    let candidates = [];
    for (const item of allItems) {
      const text = (item.textContent || '').trim();
      if (text.includes('.pdf') || text.includes('.doc') || text.includes('.PDF') || text.includes('.DOC') || text.includes('KB') || text.includes('MB')) {
        // Find the clickable selection element - radio button, or the card itself
        const radio = item.querySelector('input[type="radio"]');
        const radioBtn = item.querySelector('button[role="radio"]');
        const selectBtn = item.querySelector('button[aria-pressed], button[class*="select"]');
        const clickable = radio || radioBtn || selectBtn || item.querySelector('button') || item;

        const isSelected = (radio && radio.checked)
          || (radioBtn && radioBtn.getAttribute('aria-checked') === 'true')
          || (selectBtn && selectBtn.getAttribute('aria-pressed') === 'true')
          || item.querySelector('[aria-checked="true"]') !== null;

        // Extract date for "most recent" detection
        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        const date = dateMatch ? new Date(dateMatch[1]) : null;

        candidates.push({ item, clickable, isSelected, date, text: text.slice(0, 100) });
      }
    }

    // Strategy 2: If no structured items found, look for any clickable container with PDF text
    if (candidates.length === 0) {
      const allButtons = modal.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = (btn.textContent || '').trim();
        if ((text.includes('.pdf') || text.includes('.doc')) && text.includes('KB')) {
          candidates.push({
            item: btn, clickable: btn,
            isSelected: btn.getAttribute('aria-checked') === 'true',
            date: null, text: text.slice(0, 100)
          });
        }
      }
    }

    if (candidates.length === 0) {
      console.log('[AP] No resume candidates found in modal');
      return null;
    }

    console.log(`[AP] Found ${candidates.length} resume candidates`);

    // Select the preferred resume
    let target;
    if (preferIndex !== undefined && preferIndex < candidates.length) {
      target = candidates[preferIndex];
    } else {
      // Pick the most recent (by date) or the first one
      const withDates = candidates.filter(c => c.date);
      if (withDates.length > 0) {
        target = withDates.sort((a, b) => b.date - a.date)[0];
      } else {
        // Default to first (LinkedIn usually lists most recent first)
        target = candidates[0];
      }
    }

    if (target.isSelected) {
      console.log('[AP] Resume already selected:', target.text);
      return target.clickable;
    }

    // Click to select
    highlight(target.item);
    target.clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(humanDelay(300));
    await simulateHumanClickWithHover(target.clickable);
    await sleep(humanDelay(500));

    console.log('[AP] Selected resume:', target.text);
    return target.clickable;
  }

  // Dismiss typeahead/autocomplete overlays that block button clicks (ported from Playwright)
  async function dismissTypeaheads(modal) {
    const typeaheads = modal.querySelectorAll(
      '.basic-typeahead__triggered-content, .artdeco-typeahead__results-list, [class*="typeahead"][class*="triggered"], [class*="typeahead"][class*="dropdown"]'
    );
    if (typeaheads.length === 0) return;
    console.log(`[AP] Dismissing ${typeaheads.length} typeahead overlay(s)`);
    // Press Escape to close typeaheads
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(200);
    // Click a neutral area in the modal to ensure focus moves away
    const header = modal.querySelector('h2, h3, .artdeco-modal__header');
    if (header) {
      simulateHumanClick(header);
      await sleep(200);
    }
    // If still there, try clicking each one's Escape again
    const remaining = modal.querySelectorAll('.basic-typeahead__triggered-content');
    for (const ta of remaining) {
      const input = ta.closest('.fb-dash-form-element')?.querySelector('input');
      if (input) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        input.blur();
        await sleep(150);
      }
    }
  }

  // ==================== MODAL PATTERN CACHE ====================
  // Caches modal structures locally so the extension learns patterns over time.
  // Stored in chrome.storage.local under 'modalCache' key.

  const MODAL_CACHE_KEY = 'applyPie_modalCache';
  let modalCache = null;

  async function loadModalCache() {
    if (modalCache) return modalCache;
    try {
      const data = await chrome.storage.local.get([MODAL_CACHE_KEY]);
      modalCache = data[MODAL_CACHE_KEY] || { patterns: {}, fieldDefaults: {}, selectorHits: {} };
    } catch {
      modalCache = { patterns: {}, fieldDefaults: {}, selectorHits: {} };
    }
    return modalCache;
  }

  async function saveModalCache() {
    if (!modalCache) return;
    try {
      // Keep cache size bounded - max 200 patterns
      const keys = Object.keys(modalCache.patterns);
      if (keys.length > 200) {
        const sorted = keys.sort((a, b) => (modalCache.patterns[a].lastSeen || 0) - (modalCache.patterns[b].lastSeen || 0));
        sorted.slice(0, keys.length - 150).forEach(k => delete modalCache.patterns[k]);
      }
      await chrome.storage.local.set({ [MODAL_CACHE_KEY]: modalCache });
    } catch (e) {
      console.log('[AP] Failed to save modal cache:', e.message);
    }
  }

  function cacheModalPattern(modal) {
    loadModalCache().then(cache => {
      const fields = [];
      modal.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
        const label = findLabelForInput(input);
        const type = getFieldType(input);
        if (label) fields.push({ label, type });
      });

      // Create a signature from field labels for deduplication
      const signature = fields.map(f => `${f.type}:${f.label}`).sort().join('|');
      if (!signature) return;

      const existing = cache.patterns[signature];
      cache.patterns[signature] = {
        fields,
        count: (existing?.count || 0) + 1,
        lastSeen: Date.now(),
        modalClasses: (modal.className || '').slice(0, 200)
      };

      // Track which CSS selectors successfully found the modal
      const cls = modal.className || '';
      if (cls.includes('jobs-easy-apply')) {
        cache.selectorHits['jobs-easy-apply-modal'] = (cache.selectorHits['jobs-easy-apply-modal'] || 0) + 1;
      } else if (cls.includes('artdeco-modal')) {
        cache.selectorHits['artdeco-modal-fallback'] = (cache.selectorHits['artdeco-modal-fallback'] || 0) + 1;
      }

      saveModalCache();
    });
  }

  // Cache successful field values for auto-fill suggestions
  function cacheFieldValue(label, value) {
    if (!label || !value) return;
    loadModalCache().then(cache => {
      const key = label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!key) return;
      cache.fieldDefaults[key] = {
        value,
        usedCount: (cache.fieldDefaults[key]?.usedCount || 0) + 1,
        lastUsed: Date.now()
      };
      saveModalCache();
    });
  }

  // Get cached default for a field label
  async function getCachedFieldValue(label) {
    const cache = await loadModalCache();
    const key = label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    return cache.fieldDefaults[key]?.value || null;
  }

  const actionHandlers = {
    async click(action) {
      const el = document.querySelector(action.selector) || deepQuerySelector(document, action.selector);
      if (!el) return { ok: false, error: `Element not found: ${action.selector}` };
      highlight(el);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(300));
      simulateHumanClick(el);
      return { ok: true };
    },

    async click_job(action) {
      let card;
      if (action.linkedinId) {
        card = document.querySelector(`li[data-occludable-job-id="${action.linkedinId}"]`)
          || deepQuerySelector(document, `li[data-occludable-job-id="${action.linkedinId}"]`);
      }
      if (!card && action.index !== undefined) {
        const cards = document.querySelectorAll(SELECTORS.jobCard);
        card = cards[action.index];
        if (!card) {
          const deepCards = deepQuerySelectorAll(document, SELECTORS.jobCard);
          card = deepCards[action.index];
        }
        if (!card) {
          const allLinks = deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]');
          const parentLis = [];
          allLinks.forEach(a => { const li = a.closest('li'); if (li) parentLis.push(li); });
          card = parentLis[action.index];
        }
      }
      if (!card && action.selector) card = document.querySelector(action.selector) || deepQuerySelector(document, action.selector);
      if (!card) return { ok: false, error: 'Job card not found' };

      highlight(card);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(500));
      const clickTarget = card.querySelector('a[href*="/jobs/view/"]') || deepQuerySelector(card, 'a[href*="/jobs/view/"]') || card.querySelector('a') || card;
      await simulateHumanClickWithHover(clickTarget);
      await sleep(humanDelay(2000));
      return { ok: true, data: { jobDetail: extractJobDetail(), selectedJob: extractSelectedJob() } };
    },

    async click_apply() {
      // Auto-delegate based on page type
      if (isWorkdayPage()) return actionHandlers.workday_click_apply();
      if (detectPageType() === 'career_page') return actionHandlers.career_click_apply(action);

      let btn = findEasyApplyButton();

      if (!btn) {
        // Debug: report what buttons ARE on the page
        const visibleButtons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const buttonTexts = visibleButtons.slice(0, 15).map(b => (b.innerText || '').trim().slice(0, 40));
        return { ok: false, error: `Easy Apply button not found. Visible buttons: ${buttonTexts.join(' | ')}` };
      }

      highlight(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(400));
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(2000));

      // Dismiss any Premium upsell or unrelated popups that may have appeared
      const premiumModal = document.querySelector('div[role="dialog"].artdeco-modal');
      if (premiumModal && premiumModal.offsetParent !== null) {
        const pmText = (premiumModal.textContent || '').toLowerCase();
        if (pmText.includes('try premium') || pmText.includes('get premium') || pmText.includes('free trial') || pmText.includes('upgrade')) {
          const dismissBtn = premiumModal.querySelector('button[aria-label="Dismiss"], button.artdeco-modal__dismiss');
          if (dismissBtn) {
            simulateHumanClick(dismissBtn);
            await sleep(800);
          }
        }
      }

      const modal = findEasyApplyModal();
      if (modal) {
        // Cache this modal's structure for future reference
        cacheModalPattern(modal);
        return { ok: true, data: extractModal() };
      }
      return { ok: true, message: 'Clicked apply, waiting for modal...' };
    },

    async type(action) {
      const el = document.querySelector(action.selector) || deepQuerySelector(document, action.selector);
      if (!el) return { ok: false, error: `Element not found: ${action.selector}` };
      highlight(el);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await humanType(el, action.value);
      await sleep(humanDelay(200));
      const overlay = document.querySelector('.basic-typeahead__triggered-content');
      if (overlay) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(200);
      }
      return { ok: true };
    },

    async select(action) {
      const el = document.querySelector(action.selector) || deepQuerySelector(document, action.selector);
      if (!el) return { ok: false, error: `Element not found: ${action.selector}` };
      highlight(el);
      const opts = Array.from(el.options);
      const val = action.value.toLowerCase();
      let opt = opts.find(o => o.textContent.trim().toLowerCase() === val)
        || opts.find(o => o.textContent.trim().toLowerCase().includes(val))
        || opts.find(o => o.value.toLowerCase() === val);
      if (!opt) return { ok: false, error: `Option not found: ${action.value}. Available: ${opts.map(o => o.textContent.trim()).join(', ')}` };
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    },

    async fill_form(action) {
      // Auto-delegate based on page type
      if (isWorkdayPage()) return actionHandlers.workday_fill_form(action);
      if (detectPageType() === 'career_page') return actionHandlers.career_fill_form(action);

      const modal = findEasyApplyModal();
      if (!modal) return { ok: false, error: 'No Easy Apply modal open' };
      const formState = extractModal();
      if (!formState) return { ok: false, error: 'Could not read form' };

      // Get user's actual phone from storage for country code protection
      let userPhone = null;
      try {
        const data = await chrome.storage.local.get(['state_profile']);
        userPhone = data.state_profile?.phone || null;
      } catch {}

      const results = [];
      for (const [targetLabel, value] of Object.entries(action.fields || {})) {
        const field = formState.fields.find(f => {
          const fl = f.label.toLowerCase();
          const tl = targetLabel.toLowerCase();
          return fl.includes(tl) || tl.includes(fl) || fl === tl;
        });

        if (!field) { results.push({ label: targetLabel, status: 'not_found' }); continue; }
        if (field.value && field.value.length > 0 && field.type !== 'select') {
          results.push({ label: targetLabel, status: 'already_filled', value: field.value }); continue;
        }

        try {
          switch (field.type) {
            case 'text': case 'textarea': {
              const input = document.querySelector(field.selector) || deepQuerySelector(document, field.selector);
              if (input) {
                await humanType(input, String(value));
                cacheFieldValue(targetLabel, String(value));
                results.push({ label: targetLabel, status: 'filled' });
              }
              break;
            }
            case 'select': {
              const sel = document.querySelector(field.selector) || deepQuerySelector(document, field.selector);
              if (sel) {
                let effectiveValue = String(value);

                // Phone country code protection: if this is a country code dropdown,
                // override with the user's actual phone prefix
                const labelLower = field.label.toLowerCase();
                const isPhoneCodeField = labelLower.includes('phone') || labelLower.includes('country code')
                  || labelLower.includes('dialing') || labelLower.includes('phone code');
                const optionsLookLikeCountryCodes = Array.from(sel.options).some(o =>
                  /\+\d{1,3}/.test(o.textContent) || /\+\d{1,3}/.test(o.value)
                );

                if ((isPhoneCodeField || optionsLookLikeCountryCodes) && userPhone) {
                  const phonePrefix = userPhone.match(/^\+(\d{1,3})/);
                  if (phonePrefix) {
                    const code = '+' + phonePrefix[1];
                    const codeMatch = Array.from(sel.options).find(o =>
                      o.textContent.includes(code) || o.value.includes(code)
                    );
                    if (codeMatch) {
                      effectiveValue = codeMatch.textContent.trim();
                      console.log(`[AP] Phone code protected: using ${code} from user profile instead of ${value}`);
                    }
                  }
                }

                const valLower = effectiveValue.toLowerCase();
                const o = Array.from(sel.options).find(o =>
                  o.textContent.trim().toLowerCase().includes(valLower) ||
                  valLower.includes(o.textContent.trim().toLowerCase()) ||
                  o.value.toLowerCase() === valLower
                );
                if (o) {
                  sel.value = o.value;
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                  cacheFieldValue(targetLabel, o.textContent.trim());
                  results.push({ label: targetLabel, status: 'selected' });
                } else {
                  results.push({ label: targetLabel, status: 'option_not_found', available: field.options.map(o => o.text) });
                }
              }
              break;
            }
            case 'radio': {
              const tv = String(value).toLowerCase();
              const m = field.options.find(o =>
                o.text.toLowerCase().includes(tv) || tv.includes(o.text.toLowerCase())
              );
              if (m) {
                const radio = m.id ? document.getElementById(m.id)
                  : document.querySelector(`input[type="radio"][value="${CSS.escape(m.value)}"]`);
                if (radio) { simulateHumanClick(radio); results.push({ label: targetLabel, status: 'selected' }); }
                else results.push({ label: targetLabel, status: 'radio_not_found' });
              } else {
                results.push({ label: targetLabel, status: 'option_not_found', available: field.options.map(o => o.text) });
              }
              break;
            }
            case 'checkbox': {
              const cb = document.querySelector(field.selector) || deepQuerySelector(document, field.selector);
              if (cb && !cb.checked) { simulateHumanClick(cb); results.push({ label: targetLabel, status: 'checked' }); }
              else results.push({ label: targetLabel, status: cb?.checked ? 'already_checked' : 'not_found' });
              break;
            }
            default:
              results.push({ label: targetLabel, status: 'unsupported', type: field.type });
          }
        } catch (err) {
          results.push({ label: targetLabel, status: 'error', error: err.message });
        }
        await sleep(humanDelay(150));
      }
      return { ok: true, data: { results, currentForm: extractModal() } };
    },

    async next_step() {
      // Auto-delegate based on page type
      if (isWorkdayPage()) return actionHandlers.workday_next_step();
      if (detectPageType() === 'career_page') return actionHandlers.career_next_step();

      const modal = findEasyApplyModal();
      if (!modal) return { ok: false, error: 'No modal open' };

      // Dismiss any typeahead overlays before clicking buttons (from Playwright pattern)
      await dismissTypeaheads(modal);

      // AUTO-HANDLE RESUME SCREEN: if this is a resume selection step, select the most recent resume
      const preCheck = extractModal();
      if (preCheck?.resumeScreen?.isResumeStep) {
        console.log('[AP] Resume selection screen detected — auto-selecting most recent resume');
        if (!preCheck.resumeScreen.hasSelectedResume) {
          await findAndClickResume(modal);
          await sleep(humanDelay(500));
        } else {
          console.log('[AP] Resume already selected, proceeding');
        }
      }

      // Uncheck follow company checkbox
      const followCb = modal.querySelector(SELECTORS.followCheckbox);
      if (followCb) {
        const input = followCb.tagName === 'LABEL'
          ? followCb.querySelector('input[type="checkbox"]') || document.getElementById(followCb.getAttribute('for'))
          : followCb;
        if (input?.checked) simulateHumanClick(input);
      }

      // Check for validation errors BEFORE clicking (don't submit with errors)
      const preState = extractModal();
      if (preState?.hasErrors) {
        // If resume is required but not selected, try to select one
        if (preState.resumeScreen?.isResumeStep && !preState.resumeScreen.hasSelectedResume) {
          await findAndClickResume(modal);
          await sleep(humanDelay(500));
          // Re-check errors
          const recheck = extractModal();
          if (recheck?.hasErrors) {
            return { ok: false, error: 'Resume required but could not select one', data: recheck };
          }
        } else {
          return { ok: false, error: 'Validation errors on current step - fix fields first', data: preState };
        }
      }

      // Find the primary button
      let btn = modal.querySelector(SELECTORS.nextButton) || deepQuerySelector(modal, SELECTORS.nextButton);

      // Fallback: scan all buttons in footer for Next/Submit/Review
      if (!btn) {
        const footerBtns = modal.querySelectorAll('footer button, .artdeco-modal__actionbar button');
        for (const fb of footerBtns) {
          const t = (fb.textContent || '').trim().toLowerCase();
          if (t.includes('next') || t.includes('submit') || t.includes('review') || t.includes('continue')) {
            btn = fb;
            break;
          }
        }
      }

      if (!btn) {
        const allBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const btnTexts = allBtns.map(b => (b.textContent || '').trim().slice(0, 30));
        return { ok: false, error: `Next/Submit button not found. Visible buttons in modal: ${btnTexts.join(' | ')}` };
      }

      const buttonText = btn.textContent.trim().toLowerCase();
      const isSubmit = buttonText.includes('submit');
      const isReview = buttonText.includes('review');

      // REVIEW SCREEN: if we're on "Review", verify before proceeding to Submit
      if (isReview) {
        console.log('[AP] Review screen detected — verifying before submit');
      }

      // Use hover-click for important buttons
      highlight(btn);
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(2500));

      // CONFIRMATION DETECTION: check for success indicators
      const successIndicators = [
        'your application was sent',
        'application submitted',
        'you applied',
        'application was submitted'
      ];
      const bodyText = (document.body.innerText || '').toLowerCase();
      const hasSuccessMessage = successIndicators.some(s => bodyText.includes(s));

      if (hasSuccessMessage && isSubmit) {
        console.log('[AP] Submission confirmed via success message');
        // Dismiss any post-submit modal/dialog
        await sleep(500);
        const postDismiss = document.querySelector(SELECTORS.dismissButton);
        if (postDismiss) {
          simulateHumanClick(postDismiss);
          await sleep(300);
        }
        return { ok: true, message: 'Application submitted successfully', submitted: true };
      }

      // Check if a discard confirmation dialog appeared
      const discardBtn = document.querySelector(SELECTORS.discardButton);
      if (discardBtn) {
        if (isSubmit) {
          // After submit, discard dialog usually means "Discard saved draft" → safe to click
          simulateHumanClick(discardBtn);
          await sleep(500);
          return { ok: true, message: 'Application submitted', submitted: true };
        }
        // Non-submit discard = form had issues
        return { ok: false, error: 'Discard dialog appeared - form may have issues', data: extractModal() };
      }

      // Check if modal is still open (more steps)
      const newModal = findEasyApplyModal();
      if (newModal) {
        const formState = extractModal();
        if (formState?.hasErrors) {
          return { ok: false, error: 'Validation errors after step', data: formState };
        }
        return {
          ok: true,
          data: formState,
          buttonClicked: buttonText,
          stepType: isSubmit ? 'submit' : isReview ? 'review' : 'next'
        };
      }

      // Modal closed → application submitted (or something closed it)
      if (isSubmit) {
        return { ok: true, message: 'Application submitted', submitted: true };
      }
      // If it was "next" but modal closed, that's unexpected — report as uncertain
      return { ok: true, message: 'Modal closed after clicking ' + buttonText, submitted: isSubmit };
    },

    // Select the most recent resume on the resume selection screen
    async select_resume(action) {
      const modal = findEasyApplyModal();
      if (!modal) return { ok: false, error: 'No modal open' };

      // Find all clickable resume items
      const resumeEl = await findAndClickResume(modal, action?.index);
      if (!resumeEl) {
        return { ok: false, error: 'Could not find resume to select' };
      }
      return { ok: true, message: 'Resume selected', data: extractModal() };
    },

    async dismiss_modal() {
      // Auto-delegate based on page type
      if (isWorkdayPage()) return actionHandlers.workday_dismiss_modal();

      const dismiss = document.querySelector(SELECTORS.dismissButton) || deepQuerySelector(document, SELECTORS.dismissButton);
      if (!dismiss) return { ok: false, error: 'No dismiss button' };
      simulateHumanClick(dismiss);
      await sleep(humanDelay(500));
      const discard = document.querySelector(SELECTORS.discardButton);
      if (discard) { simulateHumanClick(discard); await sleep(300); }
      return { ok: true };
    },

    async scan_jobs() {
      const list = document.querySelector(SELECTORS.jobList) || deepQuerySelector(document, SELECTORS.jobList);
      if (list) {
        for (let i = 0; i < 3; i++) { list.scrollBy({ top: 400, behavior: 'smooth' }); await sleep(humanDelay(500)); }
        list.scrollTop = 0;
        await sleep(humanDelay(300));
      }
      const jobs = extractJobs();
      return { ok: true, data: { jobs } };
    },

    async scan_form() {
      // Auto-delegate based on page type
      if (isWorkdayPage()) return actionHandlers.workday_scan_form();
      if (detectPageType() === 'career_page') return actionHandlers.career_scan_form();

      const m = extractModal();
      return m ? { ok: true, data: m } : { ok: false, error: 'No form visible' };
    },

    async scroll(action) {
      const target = action.selector
        ? (document.querySelector(action.selector) || deepQuerySelector(document, action.selector))
        : (document.querySelector(SELECTORS.jobList) || deepQuerySelector(document, SELECTORS.jobList));
      if (!target) return { ok: false, error: 'Scroll target not found' };
      target.scrollBy({ top: action.direction === 'up' ? -400 : 400, behavior: 'smooth' });
      await sleep(humanDelay(500));
      return { ok: true };
    },

    async wait(action) { await sleep(action.ms || 1000); return { ok: true }; },

    async upload_resume() { return { ok: true, message: 'Resume upload requires manual file selection' }; },

    async navigate(action) {
      if (action.url) {
        window.location.href = action.url;
        return { ok: true, message: `Navigating to ${action.url}` };
      }
      return { ok: false, error: 'No URL provided' };
    },

    // ==================== WORKDAY ACTION HANDLERS ====================

    // Click Workday's Apply button on a job posting page
    async workday_click_apply() {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };

      // Try multiple Apply button selectors
      const applySelectors = [
        'a[data-automation-id="jobPostingApplyButton"]',
        'button[data-automation-id="jobPostingApplyButton"]',
        'a[data-automation-id="applyButton"]',
        'button[data-automation-id="applyButton"]',
      ];

      let btn = null;
      for (const sel of applySelectors) {
        btn = document.querySelector(sel);
        if (btn) break;
      }

      // Fallback: find by text
      if (!btn) {
        const allButtons = document.querySelectorAll('a, button');
        for (const b of allButtons) {
          const text = (b.textContent || '').trim().toLowerCase();
          if (text === 'apply' || text === 'apply now') {
            btn = b;
            break;
          }
        }
      }

      if (!btn) {
        const visibleBtns = Array.from(document.querySelectorAll('a, button'))
          .filter(b => b.offsetParent !== null)
          .slice(0, 15)
          .map(b => (b.textContent || '').trim().slice(0, 40));
        return { ok: false, error: `Workday Apply button not found. Visible: ${visibleBtns.join(' | ')}` };
      }

      highlight(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(400));
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(2000));

      return { ok: true, data: extractWorkdayContext() };
    },

    // Fill Workday form fields using React-aware methods
    async workday_fill_form(action) {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };

      const wdCtx = extractWorkdayContext();
      if (!wdCtx) return { ok: false, error: 'Could not read Workday page context' };
      if (!wdCtx.fields || wdCtx.fields.length === 0) return { ok: false, error: 'No form fields found on Workday page' };

      const results = [];
      for (const [targetLabel, value] of Object.entries(action.fields || {})) {
        const field = wdCtx.fields.find(f => {
          const fl = f.label.toLowerCase();
          const tl = targetLabel.toLowerCase();
          return fl === tl || fl.includes(tl) || tl.includes(fl);
        });

        if (!field) { results.push({ label: targetLabel, status: 'not_found' }); continue; }
        if (field.value && field.value.length > 0 && field.type !== 'select' && field.type !== 'dropdown') {
          results.push({ label: targetLabel, status: 'already_filled', value: field.value }); continue;
        }

        try {
          const el = document.querySelector(field.selector);
          if (!el) { results.push({ label: targetLabel, status: 'element_gone' }); continue; }

          switch (field.type) {
            case 'text':
            case 'textarea': {
              // Use React-aware filling
              const isTextarea = el.tagName.toLowerCase() === 'textarea';
              const nativeSetter = Object.getOwnPropertyDescriptor(
                isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                'value'
              )?.set;

              el.focus();
              el.dispatchEvent(new Event('focus', { bubbles: true }));
              await sleep(100);

              // Clear existing value
              if (nativeSetter) {
                nativeSetter.call(el, '');
              } else {
                el.value = '';
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              await sleep(50);

              // Type character by character for human-like behavior
              const strValue = String(value);
              for (let i = 0; i < strValue.length; i++) {
                const partial = strValue.slice(0, i + 1);
                if (nativeSetter) {
                  nativeSetter.call(el, partial);
                } else {
                  el.value = partial;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new InputEvent('input', {
                  bubbles: true, data: strValue[i], inputType: 'insertText'
                }));
                // Variable typing speed
                const delay = Math.random() < 0.1 ? (150 + Math.random() * 200) : (30 + Math.random() * 50);
                await sleep(delay);
              }

              el.dispatchEvent(new Event('change', { bubbles: true }));
              await sleep(100);
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              // Press Tab to trigger Workday's field validation
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
              await sleep(200);

              cacheFieldValue(targetLabel, strValue);
              results.push({ label: targetLabel, status: 'filled' });
              break;
            }

            case 'dropdown': {
              // Workday React dropdown: click → type to filter → select option
              const selected = await fillWorkdayDropdown(el, String(value));
              if (selected) {
                cacheFieldValue(targetLabel, String(value));
                results.push({ label: targetLabel, status: 'selected' });
              } else {
                results.push({ label: targetLabel, status: 'dropdown_option_not_found' });
              }
              break;
            }

            case 'select': {
              // Native select
              const valLower = String(value).toLowerCase();
              const opt = Array.from(el.options).find(o =>
                o.textContent.trim().toLowerCase() === valLower
                || o.textContent.trim().toLowerCase().includes(valLower)
                || valLower.includes(o.textContent.trim().toLowerCase())
              );
              if (opt) {
                el.value = opt.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                cacheFieldValue(targetLabel, opt.textContent.trim());
                results.push({ label: targetLabel, status: 'selected' });
              } else {
                results.push({ label: targetLabel, status: 'option_not_found', available: Array.from(el.options).map(o => o.textContent.trim()) });
              }
              break;
            }

            case 'checkbox': {
              const shouldCheck = ['true', 'yes', '1', 'on'].includes(String(value).toLowerCase());
              if (shouldCheck && !el.checked) {
                simulateHumanClick(el);
                results.push({ label: targetLabel, status: 'checked' });
              } else if (!shouldCheck && el.checked) {
                simulateHumanClick(el);
                results.push({ label: targetLabel, status: 'unchecked' });
              } else {
                results.push({ label: targetLabel, status: 'already_correct' });
              }
              break;
            }

            case 'radio': {
              const tv = String(value).toLowerCase();
              const matchOpt = (field.options || []).find(o =>
                o.text.toLowerCase().includes(tv) || tv.includes(o.text.toLowerCase())
              );
              if (matchOpt && matchOpt.id) {
                const radio = document.getElementById(matchOpt.id);
                if (radio) {
                  simulateHumanClick(radio);
                  results.push({ label: targetLabel, status: 'selected' });
                } else {
                  results.push({ label: targetLabel, status: 'radio_element_not_found' });
                }
              } else {
                results.push({ label: targetLabel, status: 'option_not_found', available: (field.options || []).map(o => o.text) });
              }
              break;
            }

            default:
              results.push({ label: targetLabel, status: 'unsupported_type', type: field.type });
          }
        } catch (err) {
          results.push({ label: targetLabel, status: 'error', error: err.message });
        }

        // Human-like delay between fields
        await sleep(humanDelay(300));
      }

      return { ok: true, data: { results, workday: extractWorkdayContext() } };
    },

    // Click Workday's Next/Save & Continue/Submit button
    async workday_next_step() {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };

      const preCtx = extractWorkdayContext();

      // Edge case: already on confirmation page
      if (preCtx?.isConfirmationPage) {
        return { ok: true, message: 'Workday application submitted successfully', submitted: true };
      }

      // Edge case: already applied to this job
      if (preCtx?.alreadyApplied) {
        return { ok: false, error: 'Already applied to this job on Workday', data: preCtx };
      }

      // Edge case: session expired
      if (preCtx?.isSessionExpired) {
        return { ok: false, error: 'Workday session expired. Please log in again.', data: preCtx };
      }

      // Edge case: OK/confirm modal is showing — dismiss it first
      if (preCtx?.hasOkModal) {
        const okBtn = document.querySelector('button[data-automation-id="wd-CommandButton_uic_okButton"]');
        if (okBtn) {
          simulateHumanClick(okBtn);
          await sleep(humanDelay(500));
        }
      }

      // Check for errors before proceeding
      if (preCtx?.errors?.length > 0) {
        return { ok: false, error: `Validation errors: ${preCtx.errors.join('; ')}`, data: preCtx };
      }

      // Try Workday-specific button selectors
      const btnSelectors = [
        'button[data-automation-id="bottom-navigation-next-button"]',
        'button[data-automation-id="nextButton"]',
        'button[aria-label="Save and Continue"]',
        'button[aria-label="Next"]',
        'button[data-automation-id="submitButton"]',
        'button[aria-label="Submit"]',
      ];

      let btn = null;
      for (const sel of btnSelectors) {
        btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) break;
        btn = null;
      }

      // Fallback: text-based search
      if (!btn) {
        const allBtns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        for (const b of allBtns) {
          const text = (b.textContent || '').trim().toLowerCase();
          if (text.includes('save and continue') || text.includes('next') || text.includes('submit') || text.includes('continue')) {
            btn = b;
            break;
          }
        }
      }

      if (!btn) {
        const visibleBtns = Array.from(document.querySelectorAll('button'))
          .filter(b => b.offsetParent !== null)
          .slice(0, 15)
          .map(b => (b.textContent || '').trim().slice(0, 40));
        return { ok: false, error: `Workday Next/Submit button not found. Visible: ${visibleBtns.join(' | ')}` };
      }

      const buttonText = (btn.textContent || '').trim().toLowerCase();
      const isSubmit = buttonText.includes('submit');

      highlight(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(400));
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(3000));

      // Check for errors after clicking
      const postCtx = extractWorkdayContext();

      if (isSubmit) {
        // Check for confirmation
        const bodyText = (document.body.innerText || '').toLowerCase();
        const confirmationKeywords = [
          'application submitted', 'thank you for applying', 'your application has been',
          'application received', 'successfully submitted', 'thank you for your interest'
        ];
        if (confirmationKeywords.some(k => bodyText.includes(k))) {
          return { ok: true, message: 'Workday application submitted successfully', submitted: true };
        }
      }

      if (postCtx?.errors?.length > 0) {
        return { ok: false, error: `Errors after clicking ${buttonText}: ${postCtx.errors.join('; ')}`, data: postCtx };
      }

      return {
        ok: true,
        data: postCtx,
        buttonClicked: buttonText,
        stepType: isSubmit ? 'submit' : 'next'
      };
    },

    // Click the external Apply button on LinkedIn (non-Easy Apply) to open Workday in new tab
    async click_external_apply() {
      // Find the regular "Apply" button (NOT Easy Apply)
      const applySelectors = [
        'button.jobs-apply-button',
        'a.jobs-apply-button',
        'button[aria-label="Apply"]',
        'a[aria-label="Apply"]',
        '.jobs-apply-button',
        '.jobs-s-apply button',
        '.jobs-unified-top-card button[aria-label="Apply"]',
        'a[href*="myworkdayjobs.com"]',
      ];

      let btn = null;
      for (const sel of applySelectors) {
        const el = document.querySelector(sel) || deepQuerySelector(document, sel);
        if (el) {
          const text = (el.textContent || '').trim().toLowerCase();
          // Make sure it's NOT "Easy Apply"
          if (!text.includes('easy apply')) {
            btn = el;
            break;
          }
        }
      }

      // Fallback: text scan for "Apply" (not "Easy Apply")
      if (!btn) {
        const allBtns = document.querySelectorAll('button, a');
        for (const b of allBtns) {
          const text = (b.textContent || '').trim().toLowerCase();
          if (text === 'apply' || text === 'apply now' || text === 'apply on company website') {
            btn = b;
            break;
          }
        }
      }

      if (!btn) {
        return { ok: false, error: 'External Apply button not found' };
      }

      highlight(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(400));
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(2000));

      return { ok: true, message: 'Clicked external Apply button — new tab may have opened for Workday' };
    },

    // Workday-specific form scan
    async workday_scan_form() {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };
      const ctx = extractWorkdayContext();
      if (!ctx) return { ok: false, error: 'Could not extract Workday context' };
      return { ok: true, data: ctx };
    },

    // Handle Workday file upload field
    async workday_upload_resume() {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };
      const fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) return { ok: false, error: 'No file upload field found' };

      // Check if a file is already uploaded
      const uploadZone = fileInput.closest('[data-automation-id]') || fileInput.parentElement;
      const existingFile = uploadZone?.querySelector('[data-automation-id="file-upload-item"]');
      if (existingFile) {
        return { ok: true, message: 'Resume already uploaded', data: { fileName: existingFile.textContent.trim() } };
      }

      return { ok: false, error: 'Resume upload requires manual file selection on Workday. Please upload your resume manually.' };
    },

    // Dismiss Workday OK/confirm modals
    async workday_dismiss_modal() {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };

      const okBtn = document.querySelector('button[data-automation-id="wd-CommandButton_uic_okButton"]');
      if (okBtn) {
        simulateHumanClick(okBtn);
        await sleep(humanDelay(500));
        return { ok: true, message: 'Workday OK modal dismissed' };
      }

      // Try generic close/dismiss buttons
      const closeBtns = document.querySelectorAll(
        'button[aria-label="Close"], button[aria-label="Dismiss"], button[data-automation-id="closeButton"]'
      );
      for (const btn of closeBtns) {
        if (btn.offsetParent !== null) {
          simulateHumanClick(btn);
          await sleep(humanDelay(500));
          return { ok: true, message: 'Workday modal dismissed' };
        }
      }

      return { ok: false, error: 'No Workday modal to dismiss' };
    },

    // Handle Workday date fields (separate m/d/y inputs)
    async workday_fill_date(action) {
      if (!isWorkdayPage()) return { ok: false, error: 'Not on a Workday page' };

      const dateStr = action.value || '';
      const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (!parts) return { ok: false, error: `Invalid date format: ${dateStr}. Use MM/DD/YYYY.` };

      const [, month, day, year] = parts;
      const dateInputs = {
        month: document.querySelector('input[data-automation-id="dateSectionMonth-input"]'),
        day: document.querySelector('input[data-automation-id="dateSectionDay-input"]'),
        year: document.querySelector('input[data-automation-id="dateSectionYear-input"]'),
      };

      // If a selector is provided, look within that container
      if (action.selector) {
        const container = document.querySelector(action.selector);
        if (container) {
          dateInputs.month = container.querySelector('input[data-automation-id="dateSectionMonth-input"]') || dateInputs.month;
          dateInputs.day = container.querySelector('input[data-automation-id="dateSectionDay-input"]') || dateInputs.day;
          dateInputs.year = container.querySelector('input[data-automation-id="dateSectionYear-input"]') || dateInputs.year;
        }
      }

      const filled = [];
      for (const [part, input] of Object.entries(dateInputs)) {
        if (!input) continue;
        const val = part === 'month' ? month : part === 'day' ? day : year;
        await fillWorkdayTextField(input, val);
        filled.push(part);
        await sleep(100);
      }

      return { ok: true, data: { filled, date: dateStr } };
    },

    // ==================== UNIVERSAL CAREER PAGE HANDLERS ====================

    // Scan any career page form
    async career_scan_form() {
      const ctx = extractUniversalFormContext();
      return ctx ? { ok: true, data: ctx } : { ok: false, error: 'Not a recognizable career page' };
    },

    // Click Apply on any career page
    async career_click_apply(action) {
      const ctx = extractUniversalFormContext();
      if (ctx?.applyButtonSelector) {
        const btn = document.querySelector(ctx.applyButtonSelector);
        if (btn) {
          highlight(btn);
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await sleep(humanDelay(400));
          await simulateHumanClickWithHover(btn);
          await sleep(humanDelay(2000));
          return { ok: true, data: extractUniversalFormContext() };
        }
      }
      // Fallback: find by selector
      if (action?.selector) {
        const el = document.querySelector(action.selector);
        if (el) {
          simulateHumanClick(el);
          await sleep(humanDelay(2000));
          return { ok: true, data: extractUniversalFormContext() };
        }
      }
      return { ok: false, error: 'Apply button not found on this career page' };
    },

    // Fill form on any career page using React-aware + native methods
    async career_fill_form(action) {
      const ctx = extractUniversalFormContext();
      if (!ctx?.fields?.length) return { ok: false, error: 'No form fields found on career page' };

      const results = [];
      for (const [targetLabel, value] of Object.entries(action.fields || {})) {
        // Match by label OR by detectedType
        const field = ctx.fields.find(f => {
          const fl = f.label.toLowerCase();
          const tl = targetLabel.toLowerCase();
          return fl === tl || fl.includes(tl) || tl.includes(fl) || f.detectedType === tl;
        });

        if (!field) { results.push({ label: targetLabel, status: 'not_found' }); continue; }
        if (field.value && field.value.length > 0 && field.type !== 'select' && field.type !== 'dropdown') {
          results.push({ label: targetLabel, status: 'already_filled', value: field.value }); continue;
        }

        try {
          const el = document.querySelector(field.selector);
          if (!el) { results.push({ label: targetLabel, status: 'element_gone' }); continue; }

          switch (field.type) {
            case 'text': case 'email': case 'tel': case 'number': case 'url': case 'textarea': {
              // React-aware fill
              const isTextarea = el.tagName.toLowerCase() === 'textarea';
              const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

              el.focus();
              el.dispatchEvent(new Event('focus', { bubbles: true }));
              if (nativeSetter) nativeSetter.call(el, String(value));
              else el.value = String(value);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              await sleep(100);
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              await sleep(200);
              cacheFieldValue(targetLabel, String(value));
              results.push({ label: targetLabel, status: 'filled' });
              break;
            }
            case 'select': {
              const valLower = String(value).toLowerCase();
              const opt = Array.from(el.options).find(o =>
                o.textContent.trim().toLowerCase() === valLower
                || o.textContent.trim().toLowerCase().includes(valLower)
                || valLower.includes(o.textContent.trim().toLowerCase())
              );
              if (opt) {
                el.value = opt.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                results.push({ label: targetLabel, status: 'selected' });
              } else {
                results.push({ label: targetLabel, status: 'option_not_found', available: Array.from(el.options).map(o => o.textContent.trim()) });
              }
              break;
            }
            case 'dropdown': {
              const selected = await fillWorkdayDropdown(el, String(value));
              results.push({ label: targetLabel, status: selected ? 'selected' : 'dropdown_option_not_found' });
              break;
            }
            case 'checkbox': {
              const shouldCheck = ['true', 'yes', '1', 'on'].includes(String(value).toLowerCase());
              if (shouldCheck && !el.checked) { simulateHumanClick(el); results.push({ label: targetLabel, status: 'checked' }); }
              else results.push({ label: targetLabel, status: 'already_correct' });
              break;
            }
            case 'radio': {
              const tv = String(value).toLowerCase();
              const matchOpt = (field.options || []).find(o => o.text.toLowerCase().includes(tv) || tv.includes(o.text.toLowerCase()));
              if (matchOpt?.id) {
                const radio = document.getElementById(matchOpt.id);
                if (radio) { simulateHumanClick(radio); results.push({ label: targetLabel, status: 'selected' }); }
                else results.push({ label: targetLabel, status: 'radio_not_found' });
              } else {
                results.push({ label: targetLabel, status: 'option_not_found' });
              }
              break;
            }
            default:
              results.push({ label: targetLabel, status: 'unsupported', type: field.type });
          }
        } catch (err) {
          results.push({ label: targetLabel, status: 'error', error: err.message });
        }
        await sleep(humanDelay(200));
      }
      return { ok: true, data: { results, careerPage: extractUniversalFormContext() } };
    },

    // Click Next/Submit on any career page
    async career_next_step() {
      const ctx = extractUniversalFormContext();

      if (ctx?.isConfirmationPage) {
        return { ok: true, message: 'Application submitted successfully', submitted: true };
      }

      if (ctx?.errors?.length > 0) {
        return { ok: false, error: `Validation errors: ${ctx.errors.slice(0, 3).join('; ')}`, data: ctx };
      }

      // Find submit/next button
      let btn = null;
      if (ctx?.nextButtonSelector) {
        btn = document.querySelector(ctx.nextButtonSelector);
      }
      if (!btn) {
        for (const b of document.querySelectorAll('button[type="submit"], input[type="submit"], button')) {
          const text = (b.textContent || b.value || '').trim().toLowerCase();
          if ((text.includes('submit') || text.includes('next') || text.includes('continue') || text.includes('apply')) && b.offsetParent) {
            btn = b;
            break;
          }
        }
      }

      if (!btn) return { ok: false, error: 'Submit/Next button not found on career page' };

      const buttonText = (btn.textContent || btn.value || '').trim().toLowerCase();
      highlight(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(humanDelay(400));
      await simulateHumanClickWithHover(btn);
      await sleep(humanDelay(3000));

      const postCtx = extractUniversalFormContext();
      if (postCtx?.isConfirmationPage) {
        return { ok: true, message: 'Application submitted successfully', submitted: true };
      }
      if (postCtx?.errors?.length > 0) {
        return { ok: false, error: `Errors after clicking: ${postCtx.errors.slice(0, 3).join('; ')}`, data: postCtx };
      }
      return { ok: true, data: postCtx, buttonClicked: buttonText };
    },

    // Click Google sign-in button
    async click_google_signin() {
      const ctx = extractUniversalFormContext();
      if (!ctx?.hasGoogleSignIn && !ctx?.socialSignIn?.length) {
        return { ok: false, error: 'No Google sign-in button found on this page' };
      }

      const googleBtn = ctx.socialSignIn?.find(s => s.provider === 'google');
      if (googleBtn) {
        const btn = document.querySelector(googleBtn.selector);
        if (btn) {
          highlight(btn);
          await sleep(humanDelay(300));
          simulateHumanClick(btn);
          await sleep(humanDelay(2000));
          return { ok: true, message: 'Clicked Google sign-in button' };
        }
      }

      // Fallback: click any Google sign-in element
      const fallbacks = document.querySelectorAll(
        '.g_id_signin, [class*="g_id_signin"], .abcRioButton, button, a[role="button"], div[role="button"]'
      );
      for (const el of fallbacks) {
        const text = ((el.textContent || '') + ' ' + (el.className || '')).toLowerCase();
        if (text.includes('google') && (text.includes('sign') || text.includes('log') || text.includes('continue'))) {
          highlight(el);
          simulateHumanClick(el);
          await sleep(humanDelay(2000));
          return { ok: true, message: 'Clicked Google sign-in button' };
        }
      }

      return { ok: false, error: 'Could not click Google sign-in button' };
    },

    async debug_dom() {
      const jobList = document.querySelector(SELECTORS.jobList);
      const cards = document.querySelectorAll(SELECTORS.jobCard);
      const allJobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
      const deepJobLinks = deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]');

      const mainContent = document.querySelector('.scaffold-layout__list') || document.querySelector('main');
      const listItems = mainContent ? mainContent.querySelectorAll('li') : [];
      const liClasses = new Set();
      listItems.forEach(li => {
        if (li.className) liClasses.add(li.className.trim().slice(0, 100));
      });

      // Check for shadow roots
      let shadowRootCount = 0;
      document.querySelectorAll('*').forEach(el => { if (el.shadowRoot) shadowRootCount++; });

      return {
        ok: true,
        data: {
          jobListFound: !!jobList,
          jobListTag: jobList?.tagName,
          jobListClass: jobList?.className?.slice(0, 200),
          jobCardCount: cards.length,
          jobLinksNormal: allJobLinks.length,
          jobLinksDeep: deepJobLinks.length,
          shadowRootCount,
          sampleJobLinkParent: allJobLinks[0]?.closest('li')?.className?.slice(0, 200) || 'none',
          sampleJobLinkParentAttrs: allJobLinks[0]?.closest('li')?.getAttributeNames()?.join(', ') || 'none',
          listItemClasses: Array.from(liClasses).slice(0, 10),
          scaffoldList: !!document.querySelector('.scaffold-layout__list'),
          scaffoldListInner: document.querySelector('.scaffold-layout__list')?.innerHTML?.slice(0, 300) || 'none',
          bodyTextSample: document.body.innerText?.slice(0, 500)
        }
      };
    }
  };

  async function executeAction(action) {
    const handler = actionHandlers[action.type];
    if (!handler) return { ok: false, error: `Unknown action: ${action.type}` };
    try { return await handler(action); }
    catch (err) { return { ok: false, error: err.message }; }
  }

  // ==================== MESSAGE LISTENER ====================

  // Detect if extension context is invalidated (e.g. after extension reload)
  // and silently stop to avoid chrome-extension://invalid/ errors
  function isExtensionValid() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // If extension was reloaded, this old script is orphaned - bail out
    if (!isExtensionValid()) return false;

    try {
      if (message.type === 'PING') {
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === 'GET_PAGE_CONTEXT') {
        sendResponse(getFullContext());
        return false;
      }

      if (message.type === 'EXECUTE_ACTION') {
        executeAction(message.action).then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
      }
    } catch (err) {
      // Extension context invalidated mid-call
      console.log('[AP] Extension context lost, ignoring message');
      return false;
    }
  });

  // Preload modal cache on init
  loadModalCache().then(cache => {
    const fieldCount = Object.keys(cache.fieldDefaults).length;
    const patternCount = Object.keys(cache.patterns).length;
    if (fieldCount > 0 || patternCount > 0) {
      console.log(`[ApplyPie] Loaded cache: ${fieldCount} field defaults, ${patternCount} modal patterns`);
    }
  });

  console.log('[ApplyPie] Content script loaded (stealth mode). Job cards:', document.querySelectorAll(SELECTORS.jobCard).length,
    '| Deep job links:', deepQuerySelectorAll(document, 'a[href*="/jobs/view/"]').length);
})();
