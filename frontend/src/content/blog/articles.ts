import { BLOG_AUTHOR } from './author';
import type { BlogPost, BlogCategory } from './types';

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'getting-started-with-rolepilot',
    title: 'Getting Started with RolePilot: A Comprehensive Walkthrough',
    excerpt:
      'Learn how to configure your candidate workspace, establish qualification preferences, and prepare structured applications across portals.',
    category: 'Getting Started',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-20',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 5,
    status: 'published',
    featured: true,
    coverImage: '/rolepilot-logo-transparent.png',
    seoTitle: 'Getting Started with RolePilot — Candidate Setup & Workflow Guide',
    seoDescription:
      'A step-by-step onboarding guide to setting up your RolePilot candidate profile, establishing search criteria, and staging verified applications.',
    keywords: ['getting started', 'rolepilot onboarding', 'job search guide', 'application staging'],
    prerequisites: [
      'A registered RolePilot account with a confirmed email address',
      'An updated PDF resume file ready for qualification parsing',
      'Target job titles and preferred work locations',
    ],
    sections: [
      {
        heading: 'Introduction: Intentional Job Seeking',
        body: [
          'Modern job searching is frequently overwhelmed by repetitive data entry, unorganized portal bookmarks, and disconnected submission tracking. RolePilot was built to replace ad-hoc application spamming with an intentional, audited, and repeatable workflow.',
          'Instead of filling out duplicate forms from scratch on every portal, RolePilot allows you to centralize your verified candidate profile, evaluate role readiness before applying, and stage responses for your review.',
        ],
        callout: {
          type: 'important',
          title: 'Human Review Gate',
          text: 'RolePilot is an assistive companion, not an autonomous agent. Every application field and response is staged for your explicit review and confirmation before submission.',
        },
      },
      {
        heading: 'Step-by-Step Initial Setup',
        body: [
          'Follow these core milestones to get your workspace ready for active job tracking:',
        ],
        steps: [
          {
            stepNumber: 1,
            title: 'Complete Candidate Onboarding',
            instruction:
              'After logging in, complete the initial profile onboarding wizard with your primary title, contact information, and core skill inventory.',
          },
          {
            stepNumber: 2,
            title: 'Upload and Parse Your Primary Resume',
            instruction:
              'Navigate to the Profile tab and upload your verified PDF resume. RolePilot will index your skills, past positions, and education.',
          },
          {
            stepNumber: 3,
            title: 'Define Search Criteria and Compensation',
            instruction:
              'Specify your target job titles, minimum salary expectations, remote/hybrid preferences, and notice period.',
          },
          {
            stepNumber: 4,
            title: 'Stage Your First Application Review',
            instruction:
              'Review discovered opportunities, inspect qualification readiness scores, and approve pre-staged answers before final submission.',
          },
        ],
      },
      {
        heading: 'Next Steps and Best Practices',
        body: [
          'Maintain clean data in your profile inventory to ensure pre-filled answers remain accurate. Check out our dedicated guide on Setting Up Your Profile and Resume for deeper optimization tips.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does RolePilot submit applications automatically without my approval?',
        answer:
          'No. RolePilot enforces a strict human-in-the-loop review gate. Every application must be inspected and explicitly confirmed by the candidate.',
      },
      {
        question: 'Which job boards are supported today?',
        answer:
          'LinkedIn integration is available now. Additional platforms including Indeed, Glassdoor, Naukri, and Wellfound are in active development.',
      },
    ],
    relatedSlugs: [
      'setting-up-profile-and-resume',
      'understanding-application-readiness',
      'using-the-linkedin-integration',
    ],
  },
  {
    slug: 'setting-up-profile-and-resume',
    title: 'Setting Up Your Profile and Resume for High-Match Accuracy',
    excerpt:
      'How to structure your skills, employment history, work authorizations, and resume documents to maximize qualification scoring accuracy.',
    category: 'Profile and Resume',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-21',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 6,
    status: 'published',
    featured: false,
    coverImage: '/rolepilot-icon.png',
    seoTitle: 'Setting Up Your Profile & Resume — RolePilot Guide',
    seoDescription:
      'Detailed instructions on configuring your candidate profile, managing PDF resumes, and indexing skills for automated readiness scoring in RolePilot.',
    keywords: ['resume setup', 'profile optimization', 'skills inventory', 'candidate profile'],
    prerequisites: [
      'Your latest PDF resume (under 5MB)',
      'Accurate employment dates and role descriptions',
      'Verified legal work authorizations for target jurisdictions',
    ],
    sections: [
      {
        heading: 'The Role of Structured Profile Data',
        body: [
          'Applicant tracking systems and recruitment portals evaluate candidate submissions based on specific skill keywords, years of experience, and clear work authorization.',
          'In RolePilot, your Candidate Profile acts as the single source of truth for both readiness scoring and pre-staged application answers.',
        ],
      },
      {
        heading: 'Key Profile Elements to Configure',
        body: [
          'Ensure the following components are complete and accurate before beginning application runs:',
        ],
        subsections: [
          {
            title: '1. Core Contact Information & Location',
            paragraphs: [
              'Provide your primary phone number, current city/state/country, and remote work preferences. These fields directly populate common portal screening questions.',
            ],
          },
          {
            title: '2. Skills Inventory',
            paragraphs: [
              'List both primary technical skills and secondary domain competencies. RolePilot compares this list directly against requirements in job descriptions to calculate your readiness score.',
            ],
          },
          {
            title: '3. Work Authorizations & Sponsorship',
            paragraphs: [
              'Accurately state whether you require immigration sponsorship now or in the future. Providing truthful authorization data prevents disqualification later in the interview cycle.',
            ],
          },
          {
            title: '4. Verified PDF Resume Management',
            paragraphs: [
              'Upload a clean, standard single or two-page PDF resume. Avoid non-standard fonts or complex image-only layouts that hinder text indexing.',
            ],
          },
        ],
        callout: {
          type: 'tip',
          title: 'Resume Ownership',
          text: 'Only upload resumes that belong to you. Maintain accurate dates to avoid discrepancies when employers verify your employment history.',
        },
      },
    ],
    faqs: [
      {
        question: 'Can I store multiple resume versions?',
        answer:
          'Yes, RolePilot allows you to manage multiple resume documents in your profile and select the primary active resume for your application runs.',
      },
    ],
    relatedSlugs: [
      'getting-started-with-rolepilot',
      'understanding-application-readiness',
    ],
  },
  {
    slug: 'understanding-application-readiness',
    title: 'Understanding Application Readiness: How RolePilot Evaluates Qualifications',
    excerpt:
      'A deep dive into RolePilot’s objective readiness scoring engine (0–100%) and how it identifies qualification gaps before you apply.',
    category: 'Job Search Workflows',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-22',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 5,
    status: 'published',
    featured: false,
    coverImage: '/rolepilot-icon.png',
    seoTitle: 'Understanding Application Readiness Scores — RolePilot',
    seoDescription:
      'Learn how RolePilot calculates candidate qualification readiness scores (0-100%) to help you apply strategically to the highest-match opportunities.',
    keywords: ['application readiness', 'readiness score', 'job matching', 'qualification audit'],
    prerequisites: [
      'A completed RolePilot profile with indexed skills',
      'At least one active target job listing saved in your pipeline',
    ],
    sections: [
      {
        heading: 'Why Readiness Scoring Matters',
        body: [
          'Submitting dozens of low-match applications leads to recruiter fatigue and low interview callback rates. RolePilot solves this by calculating an objective Readiness Score (0 to 100%) for every discovered opportunity before you invest time into applying.',
          'This allows you to focus your attention on roles where your background, seniority, and technical capabilities align tightly with the employer’s criteria.',
        ],
      },
      {
        heading: 'How the Score Is Calculated',
        body: [
          'RolePilot’s evaluation engine assesses several distinct dimensions:',
        ],
        subsections: [
          {
            title: 'Required Skills Match (Weight: 45%)',
            paragraphs: [
              'Compares the core technologies, frameworks, and methodologies required in the job description against your verified skills inventory.',
            ],
          },
          {
            title: 'Seniority and Experience Alignment (Weight: 30%)',
            paragraphs: [
              'Assesses years of relevant industry experience and role progression relative to the job requirements (e.g., Junior, Mid, Senior, Lead).',
            ],
          },
          {
            title: 'Compensation and Location Fit (Weight: 25%)',
            paragraphs: [
              'Checks whether the job matches your geographic preferences (remote, hybrid, on-site) and compensation floor.',
            ],
          },
        ],
        callout: {
          type: 'info',
          title: 'Illustrative Scoring',
          text: 'Readiness scores are objective internal evaluations designed to guide your personal job search strategy. They do not represent an official assessment by the hiring employer.',
        },
      },
    ],
    faqs: [
      {
        question: 'What is a good readiness score to aim for?',
        answer:
          'We recommend prioritizing applications with a readiness score of 80% or higher for the best alignment and response rates.',
      },
    ],
    relatedSlugs: [
      'getting-started-with-rolepilot',
      'using-the-linkedin-integration',
    ],
  },
  {
    slug: 'using-the-linkedin-integration',
    title: 'Using the LinkedIn Integration: Safe, Human-in-the-Loop Automation',
    excerpt:
      'Best practices for discovering opportunities, staging Easy Apply responses, and respecting portal rate limits with RolePilot.',
    category: 'LinkedIn Integration',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-23',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 6,
    status: 'published',
    featured: false,
    coverImage: '/rolepilot-icon.png',
    seoTitle: 'Using the LinkedIn Integration — RolePilot Guide',
    seoDescription:
      'Step-by-step instructions for running LinkedIn job searches, staging Easy Apply responses, and adhering to ethical rate limits in RolePilot.',
    keywords: ['linkedin integration', 'easy apply automation', 'job search automation', 'rate limits'],
    prerequisites: [
      'An active LinkedIn account in good standing',
      'Configured target titles and location preferences in RolePilot',
      'Active session on your local browser',
    ],
    sections: [
      {
        heading: 'Overview of the LinkedIn Workflow',
        body: [
          'RolePilot connects with LinkedIn to discover job postings matching your target titles, parse qualification requirements, and pre-stage Easy Apply questionnaires.',
          'Unlike aggressive bot tools that risk account flagging, RolePilot emphasizes human-paced browsing, natural delays, and mandatory user confirmation.',
        ],
        callout: {
          type: 'important',
          title: 'Ethical Automation & Rate Limits',
          text: 'RolePilot incorporates strict daily submission limits and pacing intervals to safeguard your account. Never attempt to circumvent automated safety guards.',
        },
      },
      {
        heading: 'Running an Automation Session',
        body: [
          'To start a job discovery and staging run:',
        ],
        steps: [
          {
            stepNumber: 1,
            title: 'Configure Your Run Parameters',
            instruction:
              'In the Automation tab, select LinkedIn as your target platform, define search keywords, and specify maximum jobs to inspect.',
          },
          {
            stepNumber: 2,
            title: 'Execute Discovery and Qualification Audit',
            instruction:
              'Launch the run. RolePilot will inspect matching job cards and compute readiness scores in real-time.',
          },
          {
            stepNumber: 3,
            title: 'Review Staged Applications',
            instruction:
              'Navigate to Applications to review pre-filled screening fields (e.g. years of experience, work authorizations) and confirm submission.',
          },
        ],
      },
    ],
    faqs: [
      {
        question: 'Does RolePilot store my LinkedIn password?',
        answer:
          'No. RolePilot uses session-level browser automation on your local environment and does not store your LinkedIn password on its servers.',
      },
    ],
    relatedSlugs: [
      'understanding-application-readiness',
      'preparing-and-tracking-applications',
      'account-security-and-privacy',
    ],
  },
  {
    slug: 'preparing-and-tracking-applications',
    title: 'Preparing and Tracking Applications Across Your Hiring Pipeline',
    excerpt:
      'How to organize applications from initial staging to interview rounds and final offers in a unified dashboard.',
    category: 'Application Tracking',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-24',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 5,
    status: 'published',
    featured: false,
    coverImage: '/rolepilot-icon.png',
    seoTitle: 'Preparing & Tracking Applications — RolePilot Guide',
    seoDescription:
      'Organize your hiring pipeline across Discovered, Staged, Applied, Interviewing, and Offer stages with RolePilot.',
    keywords: ['application tracking', 'hiring pipeline', 'interview tracking', 'job search organization'],
    prerequisites: [
      'Discovered job opportunities in your RolePilot workspace',
      'Verified resume attached to your profile',
    ],
    sections: [
      {
        heading: 'The Application Lifecycle in RolePilot',
        body: [
          'A disorganized job search leads to missed interview invitations and duplicate submissions. RolePilot categorizes every opportunity into five structured stages:',
        ],
        subsections: [
          {
            title: '1. Discovered',
            paragraphs: [
              'Opportunities matching your target criteria identified during automation runs. Displays readiness scores to help you prioritize.',
            ],
          },
          {
            title: '2. Staged for Review',
            paragraphs: [
              'Standard screening answers have been pre-populated from your candidate profile and are awaiting your human review and confirmation.',
            ],
          },
          {
            title: '3. Applied',
            paragraphs: [
              'Applications successfully confirmed and submitted, stamped with exact submission dates and telemetry logs.',
            ],
          },
          {
            title: '4. Interviewing',
            paragraphs: [
              'Active conversation stages with recruiters, technical screeners, or hiring managers.',
            ],
          },
          {
            title: '5. Offer / Closed',
            paragraphs: [
              'Final outcomes, compensation details, and reference records for future job search cycles.',
            ],
          },
        ],
      },
      {
        heading: 'Audit Logs & Telemetry',
        body: [
          'Every application card includes detailed timestamped audit records so you can verify exactly what was submitted and when.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I add manual applications to my RolePilot tracker?',
        answer:
          'Yes, you can track applications submitted through external career sites or personal referrals directly within your pipeline dashboard.',
      },
    ],
    relatedSlugs: [
      'getting-started-with-rolepilot',
      'using-the-linkedin-integration',
    ],
  },
  {
    slug: 'account-security-and-privacy',
    title: 'Account Security and Privacy: Best Practices for Job Seekers',
    excerpt:
      'Understanding how your profile data is stored, session token security, and how to exercise your complete data deletion rights.',
    category: 'Account and Privacy',
    author: BLOG_AUTHOR,
    publishedAt: '2026-10-25',
    updatedAt: '2026-10-25',
    readingTimeMinutes: 5,
    status: 'published',
    featured: false,
    coverImage: '/rolepilot-icon.png',
    seoTitle: 'Account Security and Privacy Guide — RolePilot',
    seoDescription:
      'Learn about RolePilot’s authentication architecture, session management, data retention, and how to request complete account deletion.',
    keywords: ['account security', 'privacy guide', 'data retention', 'account deletion'],
    prerequisites: [
      'An active RolePilot account',
      'Basic familiarity with browser cookie and storage settings',
    ],
    sections: [
      {
        heading: 'Our Privacy Philosophy',
        body: [
          'Job search data includes sensitive personal information: compensation history, contact details, resumes, and career intentions. RolePilot is engineered around privacy-first principles:',
          'We do not sell, rent, or monetize your resume data or search preferences to third-party advertisers or recruitment brokers.',
        ],
      },
      {
        heading: 'Session Hygiene and Local Storage',
        body: [
          'Authentication sessions are managed via Supabase Auth with secure JWT tokens. RolePilot stores active session keys in browser localStorage.',
          'When using shared computers, always use the explicit Log Out button in the navigation bar. This immediately purges all access tokens and cached session data from your browser.',
        ],
      },
      {
        heading: 'Exercising Your Data Deletion Rights',
        body: [
          'You hold complete ownership over your data. If you ever choose to leave RolePilot, you can delete your account and all associated records permanently:',
          'Navigate to Account Settings or trigger the account deletion endpoint (DELETE /api/v1/account). This permanently purges your profile, uploaded PDF resumes, and application logs from the active database.',
        ],
        callout: {
          type: 'warning',
          title: 'Permanent Deletion',
          text: 'Account deletion is irreversible. Download any resume versions or interview records you wish to retain before initiating deletion.',
        },
      },
    ],
    faqs: [
      {
        question: 'Where is my candidate data stored?',
        answer:
          'Data is stored in relational PostgreSQL databases hosted securely via Supabase, with API services hosted on Render.',
      },
      {
        question: 'Can I export my profile data?',
        answer:
          'Yes, you can review and copy your structured profile, skills inventory, and resume text directly from the Profile tab at any time.',
      },
    ],
    relatedSlugs: [
      'getting-started-with-rolepilot',
      'setting-up-profile-and-resume',
    ],
  },
];

// Helper functions for retrieval and filtering

export function getAllPublishedPosts(): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.status === 'published').sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const normalized = slug.trim().toLowerCase();
  return BLOG_POSTS.find(
    (post) => post.status === 'published' && post.slug.toLowerCase() === normalized
  );
}

export function getRelatedPosts(post: BlogPost, limit: number = 3): BlogPost[] {
  const published = getAllPublishedPosts();
  
  if (post.relatedSlugs && post.relatedSlugs.length > 0) {
    const related = post.relatedSlugs
      .map((slug) => published.find((p) => p.slug === slug))
      .filter((p): p is BlogPost => p !== undefined && p.slug !== post.slug);
    if (related.length >= limit) return related.slice(0, limit);
  }

  // Fallback: match by same category, excluding current post
  const sameCategory = published.filter(
    (p) => p.category === post.category && p.slug !== post.slug
  );
  const remaining = published.filter(
    (p) => p.category !== post.category && p.slug !== post.slug
  );
  return [...sameCategory, ...remaining].slice(0, limit);
}

export function getCategoriesWithCounts(): Array<{ category: BlogCategory | 'All'; count: number }> {
  const published = getAllPublishedPosts();
  const counts: Record<string, number> = {};

  for (const post of published) {
    counts[post.category] = (counts[post.category] || 0) + 1;
  }

  const categories: BlogCategory[] = [
    'Getting Started',
    'Profile and Resume',
    'LinkedIn Integration',
    'Job Search Workflows',
    'Application Tracking',
    'Account and Privacy',
    'Troubleshooting',
    'Product Updates',
  ];

  const result: Array<{ category: BlogCategory | 'All'; count: number }> = [
    { category: 'All', count: published.length },
  ];

  for (const cat of categories) {
    result.push({
      category: cat,
      count: counts[cat] || 0,
    });
  }

  return result;
}

export function searchPosts(
  query: string = '',
  category: BlogCategory | 'All' = 'All'
): BlogPost[] {
  const cleanQuery = query.trim().toLowerCase();
  let posts = getAllPublishedPosts();

  if (category !== 'All') {
    posts = posts.filter((p) => p.category === category);
  }

  if (!cleanQuery) {
    return posts;
  }

  return posts.filter((post) => {
    const inTitle = post.title.toLowerCase().includes(cleanQuery);
    const inExcerpt = post.excerpt.toLowerCase().includes(cleanQuery);
    const inCategory = post.category.toLowerCase().includes(cleanQuery);
    const inKeywords = post.keywords?.some((k) => k.toLowerCase().includes(cleanQuery));
    const inSections = post.sections.some(
      (s) =>
        s.heading.toLowerCase().includes(cleanQuery) ||
        s.body.some((b) => b.toLowerCase().includes(cleanQuery))
    );
    return inTitle || inExcerpt || inCategory || inKeywords || inSections;
  });
}
