# Seat Designer Inspector Specification

## Structure

- Chart name, category summary, place count, and search
- Validation list with focus action
- Empty-selection guidance
- One-object property form
- Multi-selection shared/mixed values
- Floor, zone, layer, category, labels, accessibility, view-from-seat, and type-specific geometry

## Behavior

Inputs validate before dispatching a typed command. Drag/range preview does not create history entries; commit happens once. Technical labels and buyer labels remain distinct. Unsupported fields never silently mutate another type.
