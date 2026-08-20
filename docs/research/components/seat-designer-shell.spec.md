# Seat Designer Shell Specification

## Overview

- Target: `src/components/seat-designer/seat-designer.tsx`
- Interaction model: persistent workspace with click, keyboard, pointer-drag, and viewport gestures
- Reference: `docs/design-references/seats-io-designer/demo-default.png`

## Structure

1. compact lifecycle/header bar;
2. top action toolbar;
3. left grouped tool rail;
4. central scene viewport with bottom status/HUD;
5. right inspector and validation rail;
6. modal surfaces for new chart, managers, import, scanner, preview, validation, and publish.

## Responsive contract

The administrator editor targets desktop and tablet landscape. At narrower widths, panels become drawers but every action remains accessible and touch targets remain at least 44 CSS px. The scene never causes page-level horizontal scrolling.

## States

Default, hover, pressed, selected, disabled, loading, empty, error, drawing, multi-selected, autosaving, saved, draft, validating, previewing, publishing, and published.
