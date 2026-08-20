# Native Seat Designer Parity Matrix

Machine-readable source: `tool-parity.json`.

| Family | Reference rows | TIG completion rule |
|---|---|---|
| Start/import | blank, template, JPG, PNG, PDF | Every path creates an independent draft and records a browser receipt |
| Scanner | configure, detect, review, accept | Candidates stay staged until one undoable accept transaction |
| Global | save/exit, preview, theme, undo/redo | UI, shortcut, disabled, loading, error, and completion states match |
| Viewport | zoom, pan, snap, contents, labels | View state never mutates document geometry |
| Selection | object, seats, brush, same type, node | Layer, lock, overlap, modifier, escape, and keyboard behavior are covered |
| Creation | focal, row, section, table, booth, area, rectangle, line, text, image, icon | Pointer preview, cancel, minimum geometry, inspector, and undo/redo all pass |
| Context | align, flip, duplicate, copy/paste, delete | Nested and relative geometry survives every action |
| Structure | layers, floors, zones, categories, seat properties | Stable IDs and valid reassignment are preserved |
| Publish | validation, venue activation, immutable revision | No show binding; venue pointer swap is atomic |

`reference-captured` means the reference surface or its explicit entry/conditional state was directly observed. It does not mean TIG is complete. Rows become `tig-verified` only after automated behavior tests and a fresh browser replay both pass at the same commit.
