import assert from 'node:assert';
import { calculateApplicationReadiness, type ApplicationReadiness } from '../frontend/src/utils/readiness.ts';
import type { Profile, Resume, Skill } from '../frontend/src/types/profile.ts';
import type { SearchConfig } from '../frontend/src/types/job.ts';

console.log('--- Testing Application Readiness Engine ---');

const baseCompleteProfile: Profile = {
  id: 'usr-123',
  first_name: 'Janmejay',
  last_name: 'Singh',
  email: 'janmejay@example.com',
  phone: '+91 9876543210',
  city: 'Noida',
  state: 'Uttar Pradesh',
  country: 'India',
  linkedin_url: 'https://linkedin.com/in/janmejaysingh',
  github_url: 'https://github.com/thejanmejay',
  website_url: 'https://janmejay.dev',
  experience_years: 3,
  experience_months: 6,
  notice_period_days: 15,
  current_ctc: 850000,
  expected_ctc: 1200000,
  authorized_to_work: true,
  willing_to_relocate: true,
  skills: [
    { id: 'sk-1', user_id: 'usr-123', name: 'Selenium', years: 2, months: 0 },
    { id: 'sk-2', user_id: 'usr-123', name: 'Java', years: 2, months: 0 },
    { id: 'sk-3', user_id: 'usr-123', name: 'Playwright', years: 1, months: 0 },
  ],
  experiences: [
    {
      id: 'exp-1',
      user_id: 'usr-123',
      company_name: 'Acme QA Corp',
      job_title: 'Senior SDET',
      start_date: '2023-01-01',
      end_date: null,
      description: 'Lead automated regression frameworks',
    },
  ],
};

const baseResumes: Resume[] = [
  {
    id: 'res-1',
    user_id: 'usr-123',
    file_name: 'Janmejay_Kumar_Singh_QA.pdf',
    storage_path: 'resumes/usr-123/res-1.pdf',
    version: 1,
    is_active: true,
    parsed_text: 'Janmejay Kumar Singh QA Automation Engineer with Selenium and Java experience...',
    parsed_data: {
      name: 'Janmejay Kumar Singh',
      skills: ['Selenium', 'Java', 'API Testing'],
      total_experience_years: 3,
    },
    created_at: new Date().toISOString(),
  },
];

const baseSearchConfigs: SearchConfig[] = [
  {
    id: 'sc-1',
    user_id: 'usr-123',
    keywords: 'QA Engineer, SDET, Automation Engineer',
    location: 'Noida / Delhi NCR',
    job_type: 'full-time',
    experience_level: '2-4 years',
    remote_type: 'hybrid',
    easy_apply_only: true,
    salary_min: 800000,
    max_jobs: 25,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Test 1: Full Profile -> Ready, 100%, 0 Blockers
{
  const result = calculateApplicationReadiness(baseCompleteProfile, baseResumes, baseSearchConfigs);
  assert.strictEqual(result.score, 100, 'Full profile must score 100%');
  assert.strictEqual(result.level, 'Ready', 'Full profile level must be "Ready"');
  assert.strictEqual(result.ready, true, 'Full profile ready flag must be true');
  assert.strictEqual(result.blockers.length, 0, 'Full profile must have 0 blockers');
  assert.strictEqual(result.warnings.length, 0, 'Full profile must have 0 warnings');
  console.log('✓ Test 1 Passed: Fully complete profile achieves 100% Ready with 0 blockers');
}

// Test 2: Intentionally leave Expected CTC missing (User requirement 2)
{
  const profileWithoutCtc: Profile = {
    ...baseCompleteProfile,
    expected_ctc: null,
  };
  const result = calculateApplicationReadiness(profileWithoutCtc, baseResumes, baseSearchConfigs);
  
  assert.ok(result.score < 100, 'Score must decrease when Expected CTC is missing');
  assert.strictEqual(result.ready, false, 'Candidate must not be ready when Expected CTC is missing');
  assert.strictEqual(result.level, 'Almost Ready', 'Level must shift to Almost Ready');
  assert.ok(result.blockers.includes('Expected Compensation (CTC) missing'), 'Blocker for Expected CTC must appear');
  
  // Verify targetSectionId for Fix 1 Blocker
  const ctcItem = result.items.find(i => i.id === 'expected_ctc');
  assert.ok(ctcItem, 'Expected CTC item must exist');
  assert.strictEqual(ctcItem.targetSectionId, 'application-preferences-section', 'Fix button must target application-preferences-section');
  assert.strictEqual(ctcItem.isBlocker, true, 'Expected CTC must be marked as blocker');
  console.log(`✓ Test 2 Passed: Expected CTC missing drops score to ${result.score}%, adds blocker, targets application-preferences-section`);
}

// Test 3: Missing Active Resume -> Blocker targeting resume-section
{
  const result = calculateApplicationReadiness(baseCompleteProfile, [], baseSearchConfigs);
  assert.strictEqual(result.ready, false, 'Candidate cannot be ready without active resume');
  assert.ok(result.blockers.includes('Active PDF Resume missing'), 'Resume blocker must be flagged');
  const resumeItem = result.items.find(i => i.id === 'active_resume');
  assert.ok(resumeItem);
  assert.strictEqual(resumeItem.targetSectionId, 'resume-section');
  assert.strictEqual(resumeItem.isBlocker, true);
  console.log('✓ Test 3 Passed: Missing resume properly creates blocker targeting resume-section');
}

// Test 4: Missing Notice Period -> Blocker targeting application-preferences-section
{
  const profileNoNotice: Profile = { ...baseCompleteProfile, notice_period_days: null };
  const result = calculateApplicationReadiness(profileNoNotice, baseResumes, baseSearchConfigs);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.includes('Notice Period missing'));
  const noticeItem = result.items.find(i => i.id === 'notice_period');
  assert.strictEqual(noticeItem?.targetSectionId, 'application-preferences-section');
  console.log('✓ Test 4 Passed: Missing notice period creates blocker targeting application-preferences-section');
}

// Test 5: Missing Work Authorization -> Blocker
{
  const profileNoAuth: Profile = { ...baseCompleteProfile, authorized_to_work: null };
  const result = calculateApplicationReadiness(profileNoAuth, baseResumes, baseSearchConfigs);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.includes('Work Authorization missing'));
  console.log('✓ Test 5 Passed: Missing work authorization creates blocker');
}

// Test 6: Missing Contact Information -> Blocker targeting contact-info-section
{
  const profileNoPhone: Profile = { ...baseCompleteProfile, phone: '' };
  const result = calculateApplicationReadiness(profileNoPhone, baseResumes, baseSearchConfigs);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.includes('Contact Information missing'));
  const contactItem = result.items.find(i => i.id === 'contact_info');
  assert.strictEqual(contactItem?.targetSectionId, 'contact-info-section');
  console.log('✓ Test 6 Passed: Missing phone creates Contact Information blocker targeting contact-info-section');
}

// Test 7: Missing Search Configuration -> Blocker targeting search-criteria-section
{
  const result = calculateApplicationReadiness(baseCompleteProfile, baseResumes, []);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.includes('Active Search Criteria missing'));
  const searchItem = result.items.find(i => i.id === 'search_config');
  assert.strictEqual(searchItem?.targetSectionId, 'search-criteria-section');
  console.log('✓ Test 7 Passed: Missing search config creates blocker targeting search-criteria-section');
}

// Test 8: Non-blocking warning (e.g. GitHub and Portfolio not provided)
{
  const profileNoWebLinks: Profile = {
    ...baseCompleteProfile,
    linkedin_url: null,
    github_url: null,
    website_url: null,
  };
  const result = calculateApplicationReadiness(profileNoWebLinks, baseResumes, baseSearchConfigs);
  assert.strictEqual(result.blockers.length, 0, 'Missing web links should NOT be a blocker');
  assert.ok(result.warnings.some(w => w.includes('Online Profiles')), 'Missing web links must be a warning');
  assert.strictEqual(result.ready, true, 'Profile is still ready even with non-blocking warning');
  console.log('✓ Test 8 Passed: Non-blocking warning correctly categorized without blocking readiness');
}

// Test 9: Severe incomplete profile -> Needs Attention (< 70%)
{
  const bareProfile: Profile = {
    id: 'usr-empty',
    first_name: '',
    email: '',
    phone: '',
    skills: [],
    experiences: [],
  };
  const result = calculateApplicationReadiness(bareProfile, [], []);
  assert.ok(result.score < 50, 'Bare profile score must be under 50%');
  assert.strictEqual(result.level, 'Needs Attention', 'Bare profile must have level "Needs Attention"');
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.length >= 5, 'Bare profile must have multiple blockers');
  console.log(`✓ Test 9 Passed: Empty profile correctly graded score=${result.score}% level="${result.level}" with ${result.blockers.length} blockers`);
}

console.log('--- All 9 Readiness Engine Unit Tests Passed Successfully! ---');
