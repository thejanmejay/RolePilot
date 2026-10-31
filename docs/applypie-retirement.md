# ApplyPie retirement

The legacy ApplyPie extension source and local Claude proxy have been removed from this repository. The active browser extension is RolePilot under `chrome-extension/rolepilot/`; it uses RolePilot authentication and existing backend APIs. It does not require a user-supplied Anthropic key or a local model proxy.

This repository cleanup does not uninstall any extension already installed in Chrome and does not access or alter Chrome profile storage. If ApplyPie is still installed, uninstall it manually from `chrome://extensions`. Its old storage keys are associated with that extension and are not migrated to RolePilot. No keys or profile data are read, exported, or deleted by this change.

The RolePilot extension currently supports sign-in, profile/preferences, dry-run search, run history, and settings. Its Apply to Jobs action remains unavailable until the required review and explicit confirmation safeguards are implemented. Existing backend session-ID automation and the Triple-Key live-submission guard remain separate and intact.
