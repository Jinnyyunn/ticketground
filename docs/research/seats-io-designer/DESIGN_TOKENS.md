# Seats.io Designer Visual Tokens

These values describe computed browser output and screenshot geometry used to guide TIG's own token system. They do not copy source CSS.

## Typography

- Editor family: Roboto, Helvetica, Arial, sans-serif
- Base: 14px / 20px, weight 400, `rgb(51 51 51)`
- Tool icon control: 22px icon box
- Inspector title: visually 16px semibold
- Helper and shortcut labels: compact 11–12px

## Geometry

- Tool button: approximately 35×35px in the captured iframe, 5px radius
- Tool rail: approximately 41px wide in iframe coordinates
- Top toolbar: approximately 50px high
- Inspector: fixed right rail with white header/validation groups and a light neutral body
- Canvas: unbounded world-space SVG with independent viewport transform
- Status/help strip: anchored to canvas bottom

## Color roles

- `editor-canvas`: white
- `editor-panel`: light neutral gray
- `editor-surface`: white
- `editor-text`: `rgb(51 51 51)`
- `editor-muted`: mid gray
- `editor-accent`: observed blue `rgb(7 132 250)`
- `editor-success`: green validation state
- `editor-warning`: amber validation state
- `editor-danger`: red destructive/error state
- `editor-border`: translucent black hairline
- `editor-selection`: blue outline/handles

TIG components must consume semantic roles rather than these raw observations. The literal values belong only in the token declaration.

## Elevation and motion

- Floating selection-layer menu and grouped tool menus use subtle neutral shadow and small radius.
- Disabled toolbar actions reduce contrast instead of disappearing.
- Active tools change icon/text color without layout shift.
- Motion is limited to state feedback: menu reveal, pressed/selected transition, viewport transform, and object preview. Layout properties are not animated.

## Reference files

- `docs/design-references/seats-io-designer/demo-default.png`
- `docs/design-references/seats-io-designer/editor-default.png`
- `docs/design-references/seats-io-designer/new-chart-mode.png`
