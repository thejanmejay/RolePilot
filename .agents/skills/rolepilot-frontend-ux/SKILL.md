---
name: rolepilot-frontend-ux
description: >-
  Governs RolePilot frontend engineering, SaaS design system tokens, responsive layouts,
  WCAG accessibility, reusable loading states, and modal interactions. Activate this skill when building
  or modifying UI pages, components, dialogs, forms, or responsive styles.
---

# RolePilot — Frontend UX, Responsive Design & Accessibility Skill

This skill enforces visual consistency, accessibility, and cross-device responsiveness across the RolePilot web application.

## 1. Activation Conditions
Activate this skill when:
- Building new UI pages, dialogs, panels, cards, or form controls.
- Updating styling, CSS tokens, layout grids, or typography.
- Ensuring responsive usability at 375px, 768px, 1024px, and 1440px viewports.
- Implementing accessibility enhancements (keyboard navigation, focus trapping, screen-reader announcements).
- Adding loading spinners, progress bars, or multi-stage processing cards.

## 2. Required Inspection Steps
1. **Design Tokens**: Check [frontend/src/index.css](file:///Users/janamjay/linkedin/frontend/src/index.css) for canonical color variables (`--primary`, `--primary-hover`, `--bg-app`, `--card-bg`, `--border-color`, `--text-main`, `--text-muted`, `--danger`, `--success`).
2. **Shared Component Library**: Inspect [frontend/src/components/common/](file:///Users/janamjay/linkedin/frontend/src/components/common/) before creating new buttons, inputs, alerts, badges, cards, or modals.
3. **Shared Loading System**: Use components from [frontend/src/components/common/loading/](file:///Users/janamjay/linkedin/frontend/src/components/common/loading/) (`ProgressBar`, `LoadingSpinner`, `ProcessingState`).
4. **Modal Conventions**: Inspect [frontend/src/components/Modal.tsx](file:///Users/janamjay/linkedin/frontend/src/components/Modal.tsx) for focus restoration, scroll locking, and Escape key handling.

## 3. Decision Rules & UX Constraints
- **Use Canonical Design Tokens**: Avoid arbitrary hex codes in inline styles when CSS variables or semantic tokens exist.
- **Never Cause Horizontal Overflow**:
  - Never use hardcoded pixel widths (`width: 600px`) without `max-width: 100%`.
  - Use `overflow-wrap: break-word` and `min-width: 0` inside flex containers to prevent layout blowout.
- **Accessible Dialogs & Modals**:
  - All dialogs must use `role="dialog"` or `role="alertdialog"`, declare `aria-modal="true"`, and provide an accessible title via `aria-labelledby`.
  - Trap focus within open dialogs and restore focus to the trigger element upon closing.
  - Support dismissal via the `Escape` key and prevent background body scrolling while open.
- **Honest Loading & Progress**:
  - Never fabricate progress percentages. If actual progress is not reported, use an indeterminate spinner or stage step indicators.
  - Include accessible status announcements (`role="status"`, `aria-live="polite"`).
  - Respect `prefers-reduced-motion` for all CSS transitions and animations.
- **Viewport Usability Standards**:
  - Mobile (375px): Single-column stacking, touch-friendly tap targets ($\ge 44\text{px}$), bottom navigation or clean drawer.
  - Tablet (768px): Fluid two-column grids where appropriate, collapsible sidebars.
  - Laptop (1024px) & Desktop (1440px): Full multi-column dashboard layouts without wasted dead space.

## 4. Implementation Workflow
1. **Component Design**: Build or reuse components from `components/common/`, passing standardized props (`variant`, `size`, `className`, `disabled`).
2. **Responsive Layout**: Use CSS grid and flexbox with media queries at `@media (max-width: 768px)` and `@media (max-width: 1024px)`.
3. **Accessibility Audit**: Verify keyboard tab order, ARIA attributes, form labels with `htmlFor` / `id`, and error announcements.
4. **Bundle Hygiene**: Import icons specifically from `lucide-react` and avoid large monolithic dependencies without chunking in `vite.config.ts`.

## 5. Verification & Acceptance Criteria
- Run `npm --prefix frontend run lint` to verify zero lint errors.
- Run `npm --prefix frontend run build` to verify clean TypeScript compilation and bundle generation.
- Run `node --test tests/test_responsive_ui_and_design_system.mjs` and `node --test tests/test_smart_onboarding_and_loading.mjs`.

## 6. Final Report Format
Document:
- UI components and pages modified or created.
- Responsive breakpoints tested and verified.
- Accessibility semantics and keyboard navigation behaviors implemented.
- Exact build and lint command outputs.
