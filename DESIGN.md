# Sublime — A second brain with a soul

## Mission
Create implementation-ready, token-driven UI guidance for Sublime — A second brain with a soul that is optimized for consistency, accessibility, and fast delivery across marketing site.

## Brand
- Product/brand: Sublime — A second brain with a soul
- URL: https://sublime.app/
- Audience: readers and knowledge seekers
- Product surface: marketing site

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=Control Upright`, `font.family.stack=Control Upright, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji`, `font.size.base=18px`, `font.weight.base=400`, `font.lineHeight.base=22px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=14px`, `font.size.md=16px`, `font.size.lg=18px`, `font.size.xl=24px`, `font.size.2xl=28px`, `font.size.3xl=64px`, `font.size.4xl=120px`
- Color palette: `color.surface.base=#000000`, `color.text.secondary=#a29e9c`, `color.text.tertiary=#908f8e`, `color.text.inverse=#00aaff`, `color.surface.muted=#efefef`, `color.surface.raised=#e5f6ff`, `color.surface.strong=#ffffff`
- Spacing scale: `space.1=2.5px`, `space.2=7.5px`, `space.3=15px`, `space.4=17.5px`, `space.5=20px`, `space.6=25px`, `space.7=30px`, `space.8=35px`
- Radius/shadow/motion tokens: `radius.xs=5px`, `radius.sm=15px`, `radius.md=20px`, `radius.lg=40px`, `radius.xl=999px`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (28), buttons (17), lists (7), navigation (4).

- Extraction diagnostics: Audience and product surface inference confidence is low; verify generated brand context.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
