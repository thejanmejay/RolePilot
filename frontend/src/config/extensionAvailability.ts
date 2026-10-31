const configuredStoreUrl = import.meta.env.VITE_ROLEPILOT_EXTENSION_STORE_URL?.trim();
const listingVerified = import.meta.env.VITE_ROLEPILOT_EXTENSION_LISTING_VERIFIED === 'true';

function getAllowedStoreUrl(value: string | undefined): string | null {
  if (!value || !listingVerified) return null;

  try {
    const url = new URL(value);
    const allowedHost =
      url.hostname === 'chromewebstore.google.com' ||
      url.hostname === 'chrome.google.com';
    const path = url.pathname.split('/').filter(Boolean);
    const listingId = path[path.length - 1] || '';
    const isListing = path[0] === 'detail' && /^[a-p]{32}$/.test(listingId);

    if (url.protocol !== 'https:' || !allowedHost || !isListing || url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export const extensionStoreUrl = getAllowedStoreUrl(configuredStoreUrl);
export const isExtensionPubliclyAvailable = Boolean(extensionStoreUrl);
