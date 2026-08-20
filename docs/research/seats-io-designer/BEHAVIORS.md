# Seats.io Designer Observable Behavior Contract

Captured on 2026-08-21 from the public Large theatre demo and a user-authorized logged-in temporary chart. This is a clean-room behavior record. It contains no Seats.io key, private payload, copied source, SDK dependency, or product asset.

## Interaction model

- The workspace is a full-height three-column editor: contextual tool rail, pan/zoom scene, and inspector/validation rail.
- The active tool is persistent until cancelled or another tool is chosen. `Escape` cancels an in-progress gesture; Select returns the editor to neutral object selection.
- A tool group has one visible representative and contextual hidden alternatives. Examples are Section/Row and Rectangular Area/Round Table/Booth. Hidden tools remain keyboard-addressable only when the active chart level supports them.
- Pointer gestures preview geometry continuously and commit one transaction on completion. Inspector changes, duplicate, paste, flip, align, scanner accept, and delete are undoable transactions.
- Space temporarily enters pan behavior. Zoom, fit, and pan alter viewport state only.
- Selection is layer-aware. The public theatre demo exposes All, Foreground decorations, Interactive objects, Background decorations, and Surroundings.

## New chart and import

The logged-in New chart screen offers `Simple`, `Sections and floors`, and `Zones`. A new Simple chart exposes:

- a trace reference upload accepting PNG, GIF, JPEG, WEBP, PDF, and SVG up to 15 MB;
- a buyer-visible background upload accepting PNG, GIF, JPEG, WEBP, and SVG up to 10 MB;
- a separate `Scan a reference chart` entry that stages detected seats for review.

TIG adds explicit Blank, Template, JPG/PNG, and PDF start choices while preserving those distinctions. Import is never an implicit mutation: sanitization and PDF page selection finish before an overlay is added, and scanner candidates are not objects until the user accepts them.

## Tool sweep receipts

The public demo was driven through each visible tool button. The selected state changed for Select, Selection brush, Select same type, Node, Focal point, Section, Rectangular Area, Rectangle, Line, Text, Image, Icon, and Hand. The logged-in editor additionally confirmed Select seats by shortcut. Row, Round Table, and Booth are contextual variants and must be tested inside a compatible Simple or section-content level.

## Top toolbar

- Save and exit / draft state
- Preview
- Color scheme
- Undo and redo with disabled states
- Snap to grid
- Show section contents
- Always show labels
- View from seats
- Align menu
- Horizontal and vertical flip
- Duplicate, copy, paste, delete
- Help

The public demo is read-only and advertises that mutations are discarded. The logged-in chart exposes Saved/Draft/Publish lifecycle states.

## Validation and inspector

The right rail separates chart-wide validation from selection properties. Directly observed validation families include duplicate objects, empty sections, unlabeled objects, category coverage, one-category-per-type, place count, and focal point. Selection properties are contextual; unsupported fields are not shown.

## Floors, zones, categories, and labels

- Floors are switched from the bottom HUD and edited from its settings control.
- Zones are a chart model, not a display-only tag.
- Categories have stable identity, label, color, ordering, and assignment.
- Technical identity and buyer-displayed labels are separate.
- Accessible, companion, restricted-view, and view-from-seat metadata are object/seat properties, not free-form decoration.

## Publication boundary

The reference lifecycle informs interaction quality only. TIG publication is intentionally venue-native: a valid draft creates an immutable revision and atomically moves the selected venue's active pointer. No show slug is stored on a chart. Shows resolve the active chart through their venue.

## Evidence limits

The scanner entry, accepted file types, and staging intent were directly observed. The Aside iframe disconnected before a stable end-to-end scanner review capture could be retained. Those rows remain reference-only until the TIG scanner exists and a fresh serial reference/TIG replay closes them; they are not claimed as final parity evidence.
