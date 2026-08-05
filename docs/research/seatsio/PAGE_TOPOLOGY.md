# Seat Designer Page Topology

## Route

`/admin/seat-designer` — full-screen editor (no site marketing chrome).

## Structure

```
SeatDesigner (h-screen flex col)
├── TopToolbar
├── body (flex row flex-1 min-h-0)
│   ├── ToolPicker (w-11)
│   ├── canvas-stack (flex-1 relative)
│   │   ├── LayerPicker (absolute, when open)
│   │   ├── DesignerCanvas (SVG world)
│   │   ├── NavigationHud (absolute bottom-left)
│   │   └── StatusBar (absolute bottom)
│   └── Inspector (w-80)
├── CategoryManagerDialog (modal)
└── PreviewOverlay (optional full-screen renderer)
```

## Interaction model

- Click-driven tools + keyboard shortcuts  
- Canvas: pan (hand / space / middle), zoom (wheel / buttons)  
- Drag to draw rows, sections, shapes  
- Marquee select with Select tool  
- Inspector updates with selection  

## Data flow

`chart` JSON ⇄ localStorage + download/upload ⇄ preview renderer  
Undo stack snapshots entire chart document.
