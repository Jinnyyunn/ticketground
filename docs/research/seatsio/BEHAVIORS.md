# Seat Designer Behaviors

## Implemented (matching seats.io demo tools)

| Behavior | Trigger | Notes |
|----------|---------|-------|
| Select / marquee | Select tool + drag empty canvas | Selects objects whose center is in box |
| Select seats | Select seats / brush | Brush drag hits nearby seats |
| Select same type | Z + click object | Selects all of that type |
| Focal point | F + click | Sets blue crosshair |
| Draw row | R + two clicks | 12 seats along line, snap optional |
| Draw section | S + clicks, double-click finish | Polygon section |
| Draw area | G + clicks, double-click | GA area with capacity |
| Round table | E + click | 8 seats around table |
| Booth | B + drag or click | Rectangular booth |
| Rectangle | H + drag | Decorative rect |
| Line | L + two clicks | Line decoration |
| Text | T + click | Prompt for label |
| Image / Icon | I / O + click | Placeholder image / star icon |
| Hand / pan | SPACE or Hand tool, wheel | Pan canvas |
| Zoom | Alt/Cmd+wheel, ± buttons | Cursor-centered zoom |
| Undo/Redo | ⌘Z / ⌘⇧Z | Chart document snapshots |
| Copy/Paste/Duplicate | ⌘C/V/J | Offset clones |
| Delete | Delete/Backspace | Removes selection |
| Snap to grid | Toolbar toggle | 8px grid |
| Show section contents | Toolbar | Nested seats visible |
| Always show labels | Toolbar | Section/seat labels |
| Dark canvas | Theme toggle | Dark background |
| Categories manage | Inspector Manage | Add/remove/recolor |
| Apply category | Selection + chip | Recolors seats/objects |
| Validation | Live | Dup labels, categories, focal, etc. |
| Save | localStorage | Auto path + Save button |
| Export/Import JSON | Toolbar / Inspector | File download/upload |
| Preview | Eye button | Hand-only view mode |
| Selection layer filter | Layer picker | Filters selection targeting |

## Demo data

Large theatre chart: STAGE, Golden Circle, Arena, Sections A–F, Stalls, Circles P–Y, East/West Choir, 5 categories, focal point set. Fully editable (unlike seats.io public demo which is read-only).

## Intentionally simplified vs commercial seats.io

- Node dragging for freeform polygon reshape is stubbed (select only)
- Background/reference image tracing is placeholder
- Multi-floor editing UI is single floor badge
- View-from-seat images not implemented
- Curved row control is data-backed but no inspector curve slider UI
- 4367 places: procedural chart is dense but not byte-identical seat count
