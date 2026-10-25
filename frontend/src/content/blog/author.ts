/**
 * Author configuration for RolePilot Blog and Knowledge Base.
 * 
 * Centralized author profile ensuring consistent presentation across
 * articles, author cards, schema.org structured data, and the About page.
 */
export interface AuthorProfile {
  name: string;
  title: string;
  linkedIn: string;
  avatarUrl: string;
  bio: string;
}

export const BLOG_AUTHOR: AuthorProfile = {
  name: 'Janmejay Singh',
  title: 'Product Innovation Manager at RolePilot',
  linkedIn: 'https://www.linkedin.com/in/thejanmejaysingh/',
  avatarUrl: '/rolepilot-icon.png',
  bio: 'Product Innovation Manager at RolePilot. Leading product architecture, structured candidate workflows, qualification readiness scoring, and human-in-the-loop application assistance.',
};
