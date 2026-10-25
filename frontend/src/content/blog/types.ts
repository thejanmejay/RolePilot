import type { AuthorProfile } from './author';

export type BlogCategory =
  | 'Getting Started'
  | 'Profile and Resume'
  | 'LinkedIn Integration'
  | 'Job Search Workflows'
  | 'Application Tracking'
  | 'Account and Privacy'
  | 'Troubleshooting'
  | 'Product Updates';

export interface ArticleSection {
  heading: string;
  body: string[];
  subsections?: Array<{
    title: string;
    paragraphs: string[];
  }>;
  callout?: {
    type: 'tip' | 'warning' | 'info' | 'important';
    title: string;
    text: string;
  };
  steps?: Array<{
    stepNumber: number;
    title: string;
    instruction: string;
  }>;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  author: AuthorProfile;
  publishedAt: string; // ISO 8601 date string (e.g., '2026-10-25')
  updatedAt: string;
  readingTimeMinutes: number;
  status: 'published' | 'draft';
  featured?: boolean;
  coverImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  prerequisites?: string[];
  sections: ArticleSection[];
  faqs?: FAQItem[];
  relatedSlugs?: string[];
}
