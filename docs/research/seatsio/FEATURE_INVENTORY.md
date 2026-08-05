# seats.io Chart Designer — Feature Inventory

Source: https://www.seats.io/demos/designer/demoChartLargeTheatre2D  
Iframe: `cdn-eu.seatsio.net/.../chart-designer-v2/chartDesignerIframe.html`  
Demo mode: **Read only** (edits discarded). Our clone is fully editable.

## Layout (desktop ~1290×850 iframe)

| Region | Class | Size | Role |
|--------|-------|------|------|
| Top bar | `.Panel.snap-top` | 45px h | Chart name, preview, theme, undo/redo, view toggles, edit actions |
| Left tools | `.Panel.snap-left` / `.ToolPicker` | 42px w | Drawing & selection tools |
| Layer popup | `.SelectionLayerPicker` | ~249×191 | Filter selectable object layers |
| Canvas | `.chartdesigner` SVG | huge world (20000×20000) | Floor plan |
| Right inspector | `.Panel.snap-right` / `.Inspector` | 335px w | Categories, places, validation |
| Nav HUD | `.NavigationHUD` | bottom-left | Mini compass / pan + zoom |

Marketing chrome outside iframe (Seats.io site header + demo chart thumbnails) is **not** part of the product editor.

## Top toolbar actions

- Save & exit
- Preview (eye)
- Toggle color scheme (light/dark canvas)
- Undo ⌘Z / Redo ⌘⇧Z
- Snap to grid
- Show section contents
- Always show labels
- Align center
- Flip horizontally / vertically
- Duplicate ⌘J
- Copy ⌘C / Paste ⌘V
- Delete
- Help
- Zoom out / in (alt + mouse wheel)
- Floor 1 (⌘⌥1) + Edit floors
- Valid status

## Drawing tools (left ToolPicker)

| Tool | Shortcut | Purpose |
|------|----------|---------|
| Select tool | V | Select / marquee objects |
| Select seats tool | X | Select individual seats |
| Selection brush tool | C | Brush-select seats |
| Select same type tool | Z | Select all of same type |
| Node tool | A | Edit polygon/section nodes |
| Focal point tool | F | Set best-available focal point |
| Row tool | R | Draw seat rows |
| Section tool | S | Draw sections (floors/zones) |
| Round Table tool | E | Round tables with seats |
| Booth tool | B | Trade-show booths |
| Rectangular Area tool | G | GA / standing areas |
| Rectangle tool | H | Decorative rectangles |
| Line tool | L | Lines |
| Text tool | T | Labels / text |
| Image tool | I | Images |
| Icon tool | O | Icons |
| Hand tool | SPACE | Pan canvas |

## Selection layers

1. All objects  
2. Foreground decorations  
3. Interactive objects  
4. Background decorations  
5. Surroundings  

## Inspector (chart-level)

- Chart name  
- N categories + Manage  
- Place count  
- Validation checks:
  - No duplicate objects  
  - All objects are labeled  
  - All objects are categorized  
  - One category per object type  
  - Focal point is set  

## Object model (from docs + demo)

- Rows (ordered seats, optional curve)  
- Sections (polygons, nested content)  
- Tables (round, book-as-whole / variable occupancy — paid toggles)  
- Booths  
- Areas (GA)  
- Shapes (rect, line, poly)  
- Text, Image, Icon  
- Focal point  
- Floors / zones  
- Categories (key, label, color)  
- Background image / reference chart (paid-style features we implement lightly)  

## Demo chart: Large theatre

- ~4,367 places, 5 categories  
- Sections: STAGE, Golden Circle, Arena, Section A–F, Stalls G–O, Circle P–Y, East/West Choir  
- Colors: orange (inner), green (stalls), blue (circle), red/pink (choir)  

## Design tokens

- Font: Roboto, Helvetica, Arial, sans-serif 14px  
- Text: `#333`  
- Panel bg: `#f5f5f5`  
- Selected tool accent: `#0784fa`  
- Borders: `rgba(0,0,0,0.08)`  
- Canvas light mode white  
- Validation OK green  
