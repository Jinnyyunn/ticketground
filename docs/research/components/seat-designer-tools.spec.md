# Seat Designer Tools Specification

## Contract

Every tool implements one `ToolController` with pointer-down/move/up, keyboard, cancel, preview, and commit behavior. Tool selection is accessible by click and the displayed shortcut. Unsupported contextual tools remain discoverable but disabled with a reason.

## Groups

- Selection: Select V, Select seats X, Brush C, Same type Z, Node A
- Structure: Focal point F, Row R, Section S
- Bookable: Round Table E, Booth B, Rectangular Area G
- Decoration: Rectangle H, Line L, Text T, Image I, Icon O
- Viewport: Hand Space

## Visual states

Controls share a semantic 44px TIG hit target with a compact 35px visual icon box, 5px radius, accent selected state, neutral hover, visible focus ring, disabled contrast, and a tooltip containing name plus shortcut.
