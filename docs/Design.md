# Ticketground

## Mission
Create implementation-ready, token-driven UI guidance for Ticketground that is optimized for consistency, accessibility, and fast delivery across content site.

## Brand
- Product/brand: Ticketground
- URL: https://ticketground.kr
- Audience: readers and knowledge seekers
- Product surface: content site

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=-apple-system`, `font.family.stack=-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, Noto Sans, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji`, `font.size.base=10px`, `font.weight.base=400`, `font.lineHeight.base=normal`
- Typography scale: `font.size.xs=0px`, `font.size.sm=10px`, `font.size.md=11.7px`, `font.size.lg=12px`, `font.size.xl=13px`, `font.size.2xl=13.33px`, `font.size.3xl=14px`, `font.size.4xl=15px`
- Color palette: `color.surface.base=#000000`, `color.text.secondary=#29292d`, `color.text.tertiary=#0000ee`, `color.text.inverse=#999999`, `color.surface.muted=#ffffff`, `color.surface.raised=#f3f3f3`
- Spacing scale: `space.1=1px`, `space.2=2px`, `space.3=4px`, `space.4=6px`, `space.5=8px`, `space.6=10px`, `space.7=11px`, `space.8=11.62px`
- Radius/shadow/motion tokens: `radius.xs=4px`, `radius.sm=8px`, `radius.md=11px`, `radius.lg=12px`, `radius.xl=32px`, `radius.2xl=100px` | `shadow.1=rgba(0, 0, 0, 0.13) 0px 0px 8px 0px`

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
- Include known page component density: cards (102), links (61), buttons (44), lists (24), navigation (6), inputs (4).


## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
