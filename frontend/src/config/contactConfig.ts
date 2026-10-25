/**
 * Contact configuration for RolePilot.
 *
 * Configures the Google Form destination and field entry IDs for prefilled responses.
 */

export const CONTACT_CONFIG = {
  // Google Form destination URLs
  shortUrl: 'https://forms.gle/mABzAVM1Wnhgu9xv8',
  responderUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLScEIhtak-KPNZ-gDWMFkunP2yihTpLdpTLx9XbAWI4fi6PNVg/viewform',

  // Entry IDs extracted from the Google Form's public definition
  entryIds: {
    name: 'entry.1972022550',
    email: 'entry.402706908',
    topic: 'entry.1103946435',
    message: 'entry.1595425484',
  },

  // Topics supported in the RolePilot contact interface
  topics: [
    'General Inquiry',
    'Product Feedback',
    'Technical Support',
    'LinkedIn Integration',
    'Account and Privacy',
    'Bug Report',
    'Accessibility Barrier',
    'Other',
  ] as const,

  // Intended contact recipient (for reference only; notifications managed via Google Forms)
  recipientEmail: 'janmejaysingh331@gmail.com',
};

export type ContactTopic = (typeof CONTACT_CONFIG.topics)[number];

/**
 * Builds a prefilled Google Form URL from candidate contact form entries.
 */
export function buildPrefilledGoogleFormUrl(params: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): string {
  const url = new URL(CONTACT_CONFIG.responderUrl);
  url.searchParams.set('usp', 'pp_url');

  if (params.name.trim()) {
    url.searchParams.set(CONTACT_CONFIG.entryIds.name, params.name.trim());
  }
  if (params.email.trim()) {
    url.searchParams.set(CONTACT_CONFIG.entryIds.email, params.email.trim());
  }
  if (params.topic.trim()) {
    // If the topic matches one of the options in Google Form or fallback
    url.searchParams.set(CONTACT_CONFIG.entryIds.topic, params.topic.trim());
  }
  if (params.message.trim()) {
    url.searchParams.set(CONTACT_CONFIG.entryIds.message, params.message.trim());
  }

  return url.toString();
}
