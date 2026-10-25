import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('BLOG_AUTHOR centralized profile defines Janmejay Singh as Product Innovation Manager at RolePilot', () => {
  const authorFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/content/blog/author.ts'),
    'utf-8'
  );

  assert.ok(authorFile.includes("name: 'Janmejay Singh'"), 'Author name must be Janmejay Singh');
  assert.ok(
    authorFile.includes("title: 'Product Innovation Manager at RolePilot'"),
    'Author title must be Product Innovation Manager at RolePilot'
  );
  assert.ok(
    authorFile.includes("linkedIn: 'https://www.linkedin.com/in/thejanmejaysingh/'"),
    'Author LinkedIn link must be correct'
  );
  assert.ok(
    !authorFile.includes("title: 'Founder'") && !authorFile.includes("title: 'CEO'"),
    'Author title must strictly use Product Innovation Manager at RolePilot'
  );
});

test('AboutPage displays author with Product Innovation Manager title and no CEO/Founder claims', () => {
  const aboutFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/pages/AboutPage.tsx'),
    'utf-8'
  );

  assert.ok(aboutFile.includes('AuthorCard'), 'AboutPage must include AuthorCard');
  assert.ok(aboutFile.includes('BLOG_AUTHOR'), 'AboutPage must reference BLOG_AUTHOR');
  assert.ok(
    !aboutFile.includes('CEO') && !aboutFile.includes('Co-Founder'),
    'AboutPage must not describe author as CEO or Co-Founder'
  );
});

test('Initial 6 articles exist, have unique slugs, valid metadata, and published status', () => {
  const articlesFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/content/blog/articles.ts'),
    'utf-8'
  );

  const expectedSlugs = [
    'getting-started-with-rolepilot',
    'setting-up-profile-and-resume',
    'understanding-application-readiness',
    'using-the-linkedin-integration',
    'preparing-and-tracking-applications',
    'account-security-and-privacy',
  ];

  for (const slug of expectedSlugs) {
    assert.ok(articlesFile.includes(`slug: '${slug}'`), `Article with slug '${slug}' must exist`);
  }

  // Ensure helper functions are exported
  assert.ok(articlesFile.includes('export function getAllPublishedPosts'), 'getAllPublishedPosts must be exported');
  assert.ok(articlesFile.includes('export function getPostBySlug'), 'getPostBySlug must be exported');
  assert.ok(articlesFile.includes('export function searchPosts'), 'searchPosts must be exported');
  assert.ok(articlesFile.includes('export function getCategoriesWithCounts'), 'getCategoriesWithCounts must be exported');
});

test('App.tsx routes /blog and dynamic /blog/:slug in public whitelist', () => {
  const appFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/App.tsx'),
    'utf-8'
  );

  assert.ok(appFile.includes("'/blog'"), "App.tsx must include '/blog' in PUBLIC_ROUTES");
  assert.ok(
    appFile.includes("norm.startsWith('/blog/')"),
    "App.tsx must allow dynamic '/blog/' subpaths in isPublicRoute"
  );
  assert.ok(appFile.includes('<BlogListPage'), 'App.tsx must render BlogListPage');
  assert.ok(appFile.includes('<BlogPostPage'), 'App.tsx must render BlogPostPage');
});

test('BlogPostPage includes schema.org Article structured data with author metadata', () => {
  const postPageFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/pages/BlogPostPage.tsx'),
    'utf-8'
  );

  assert.ok(postPageFile.includes("'@type': 'Article'"), 'BlogPostPage must inject Article schema');
  assert.ok(postPageFile.includes('name: post.author.name'), 'Article schema must include author name');
  assert.ok(postPageFile.includes('jobTitle: post.author.title'), 'Article schema must include author jobTitle');
  assert.ok(postPageFile.includes('url: post.author.linkedIn'), 'Article schema must include author LinkedIn url');
  assert.ok(postPageFile.includes('canonical'), 'BlogPostPage must update canonical link');
});

test('robots.txt and sitemap.xml exist and allow crawling of all published blog routes', () => {
  const robotsFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/public/robots.txt'),
    'utf-8'
  );
  assert.ok(robotsFile.includes('Allow: /blog'), 'robots.txt must allow /blog');
  assert.ok(robotsFile.includes('Allow: /blog/*'), 'robots.txt must allow /blog/*');
  assert.ok(robotsFile.includes('sitemap.xml'), 'robots.txt must link to sitemap.xml');

  const sitemapFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/public/sitemap.xml'),
    'utf-8'
  );
  assert.ok(sitemapFile.includes('<loc>https://rolepilot-frontend-phi.vercel.app/blog</loc>'), 'sitemap.xml must include /blog');
  assert.ok(
    sitemapFile.includes('getting-started-with-rolepilot'),
    'sitemap.xml must include initial article slugs'
  );
  assert.ok(
    sitemapFile.includes('account-security-and-privacy'),
    'sitemap.xml must include security article slug'
  );
});

test('PublicFooter includes Blog link in navigation links', () => {
  const footerFile = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/components/common/PublicFooter.tsx'),
    'utf-8'
  );

  assert.ok(footerFile.includes('href="/blog"'), 'PublicFooter must link to /blog');
});
