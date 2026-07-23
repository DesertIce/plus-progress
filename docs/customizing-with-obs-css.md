# Customize the overlay with OBS CSS

OBS Browser Sources can apply CSS after the overlay stylesheet without changing
the deployed page. Open the Browser Source properties and paste overrides into
the **Custom CSS** field.

This guide defines the customization hooks that the project is working toward
as a stable CSS contract. Prefer the documented custom properties and classes.
Element IDs, undeclared properties, generated pseudo-elements, and other
stylesheet details remain internal and may change.

## Quick start

Change the accent colors in every layout:

```css
:root {
  --plus-color-accent: #00e5ff;
  --plus-color-accent-bright: #b8f8ff;
  --plus-progress-fill-background: linear-gradient(90deg, #008ea3, #00e5ff);
  --plus-constrained-progress-background: linear-gradient(135deg, #008ea3cc, #00e5ff70);
}
```

Click **OK** to apply the CSS. If OBS retains older assets, reopen the source
properties and select **Refresh cache of current page**.

## Automatic responsive layouts

The Browser Source viewport selects the composition automatically. The aspect
ratio comes from the source width and height configured in OBS, not from its
scaled size in the scene.

| Mode | Automatic range | Primary presentation | Constrained fallback |
| --- | --- | --- | --- |
| Horizontal | Aspect ratio at least `4 / 3` | Score beside a marked horizontal goal ruler | At `95px` high or less, the ruler becomes a left-to-right background fill |
| Square | Between portrait and horizontal ratios | Centered compact information tile | At `139px` wide or high or less, secondary metadata is removed |
| Portrait | Aspect ratio at most `3 / 4` | Full-height card with a vertical goal spine | At `110px` wide or less, the spine becomes a bottom-to-top background fill |

The resulting six modes are:

- **Horizontal**
- **Constrained horizontal** (`95px` high or less)
- **Square**
- **Constrained square** (`139px` wide or high or less)
- **Portrait**
- **Constrained portrait** (`110px` wide or less)

Square intentionally has no progress rail and no progress-colored background
fill, including its constrained fallback. The score, target, and remaining
points carry the meaning without turning the whole tile into a meter.

Primary layouts show the UTC month and relative update age. Constrained layouts
remove those two pieces of metadata before reducing the score and goal copy.
Completed and stale progress still use their state-aware copy and colors.

The exact square query uses `751 / 1000` through `1332 / 1000` so the boundary
ratios themselves belong to portrait and horizontal. Media-query thresholds
cannot use custom properties. To change a breakpoint or a mode-specific rule,
paste a later media query into OBS Custom CSS as shown in the examples.

## Custom properties

Override these on `:root`. Values that describe a primary or constrained mode
only take effect while that mode is active.

| Property | Default | Purpose |
| --- | --- | --- |
| `--plus-font-family` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | All widget text |
| `--plus-color-text` | `#f7f5ff` | Primary score and message text |
| `--plus-color-muted` | `#b8b2c8` | Month, target, and update text |
| `--plus-color-accent` | `#a970ff` | Active progress and general accent |
| `--plus-color-accent-bright` | `#c8a7ff` | Goal-ruler target marker |
| `--plus-color-success` | `#73e6b1` | Completed-goal state |
| `--plus-color-warning` | `#ffb36b` | Stale state |
| `--plus-overlay-padding` | `6px` | Transparent space around the card |
| `--plus-card-width` | `920px` | Maximum horizontal card width |
| `--plus-card-height` | `128px` | Primary horizontal card height |
| `--plus-card-min-height` | `116px` | Primary horizontal minimum height |
| `--plus-card-padding` | `15px 19px 12px` | Primary horizontal content padding |
| `--plus-card-compact-height` | `100%` | Card height in constrained modes |
| `--plus-card-compact-min-height` | `0` | Minimum card height in constrained modes |
| `--plus-card-compact-padding-inline` | `13px` | Horizontal padding in constrained modes |
| `--plus-square-card-padding` | `16px` | Primary square content padding |
| `--plus-portrait-card-padding` | `16px 14px 14px` | Primary portrait content padding |
| `--plus-card-border` | `1px solid color-mix(in srgb, var(--plus-color-accent) 34%, #373044)` | Complete card border declaration |
| `--plus-card-radius` | `10px 3px 10px 3px` | Card corner radii |
| `--plus-card-background` | `linear-gradient(100deg, #211a31f2 0%, #181521ed 45%, #121019f2 100%)` | Neutral card background |
| `--plus-card-texture` | `repeating-linear-gradient(108deg, transparent 0 34px, #ffffff05 35px 36px)` | Decorative card overlay; use `none` to remove it |
| `--plus-card-shadow` | `0 14px 35px #08060d73, inset 0 1px 0 #ffffff12` | Outer and inset card shadows |
| `--plus-progress-height` | `12px` | Horizontal ruler height |
| `--plus-portrait-progress-width` | `12px` | Portrait goal-spine width |
| `--plus-progress-track-border` | `1px solid #655a73` | Complete ruler/spine border |
| `--plus-progress-track-background` | `#09080da6` | Unfilled ruler/spine background |
| `--plus-progress-fill-background` | `linear-gradient(90deg, #7644c2, var(--plus-color-accent) 72%, #c5a0ff)` | Active horizontal ruler fill |
| `--plus-progress-fill-completed-background` | `linear-gradient(90deg, #2da673, var(--plus-color-success))` | Completed ruler/spine fill |
| `--plus-progress-fill-shadow` | `0 0 12px color-mix(in srgb, var(--plus-color-accent) 42%, transparent)` | Ruler/spine glow |
| `--plus-progress-ticks` | `repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), #f5efff29 calc(10% - 1px) 10%)` | Horizontal ruler ticks; use `none` to remove them |
| `--plus-progress-transition` | `width 650ms cubic-bezier(0.22, 1, 0.36, 1), height 650ms cubic-bezier(0.22, 1, 0.36, 1)` | Rail and spatial-fill animation |
| `--plus-constrained-progress-background` | `linear-gradient(135deg, #7341bdcc, #a970ff70)` | Constrained horizontal/portrait spatial fill |
| `--plus-constrained-progress-completed-background` | `linear-gradient(135deg, #23805dcc, #73e6b170)` | Completed constrained spatial fill |
| `--plus-constrained-progress-shadow` | `0 0 22px color-mix(in srgb, var(--plus-color-accent) 38%, transparent)` | Constrained spatial-fill glow |

The live percentage is intentionally not a customization hook. JavaScript owns
it so CSS themes cannot accidentally make the visual value disagree with the
numeric score.

## Element classes

Use classes when a custom property does not cover visibility or structure.

### Shell

| Class | Element |
| --- | --- |
| `.overlay` | Full Browser Source canvas and state-bearing root |
| `.overlay-card` | Visible card and constrained spatial-fill surface |

### Header

| Class | Element |
| --- | --- |
| `.header-row` | Month header |
| `.month-label` | Current UTC month |

### Progress

| Class | Element |
| --- | --- |
| `.progress-view` | Responsive score, status, and rail composition |
| `.score-row` | Score and remaining-points group |
| `.score` | Current and target point group |
| `.score-divider` | Slash shown in horizontal modes |
| `.score-target` | Target value; prefixed with “of” in square and portrait |
| `.status-text` | Remaining, completed, or cached goal copy |
| `.rail-wrap` | Goal ruler/spine wrapper |
| `.progress-rail` | Accessible progress track |
| `.progress-fill` | Filled portion of the ruler/spine |
| `.rail-ticks` | Ten-percent tick overlay |
| `.target-bracket` | End-of-goal marker |

### Messages

| Class | Element |
| --- | --- |
| `.message-view` | Loading, setup, and error message container |
| `.message-title` | Message heading |
| `.message-body` | Message detail |

### Footer

| Class | Element |
| --- | --- |
| `.footer-row` | Update and refresh row |
| `.updated-text` | Last successful update age |
| `.refresh-button` | Manual refresh control |

## Render states

The root is `.overlay[data-state="STATE"]`. Combine a state selector with a
documented class:

| State | Meaning |
| --- | --- |
| `loading` | Initial Twitch request is in progress |
| `success` | Current progress is below the target |
| `completed` | Current progress has reached or exceeded the target |
| `stale` | Cached progress is shown after a transient refresh failure |
| `error` | No valid progress is available after an error |
| `missing_channel` | The Browser Source URL has no channel query value |
| `channel_not_found` | Twitch did not find the requested login |
| `widget_unavailable` | The goal is not publicly shared |
| `plus_status_null` | Twitch returned no public goal status |
| `unknown_widget_setting` | Twitch returned an unsupported goal setting |

For example:

```css
.overlay[data-state="stale"] .overlay-card,
.overlay[data-state="error"] .overlay-card {
  --plus-card-border: 2px solid var(--plus-color-warning);
}
```

## Examples

Each example is independent. Combine only the declarations you want.

### Change the complete color theme

```css
:root {
  --plus-color-accent: #00e5ff;
  --plus-color-accent-bright: #b8f8ff;
  --plus-card-background: linear-gradient(100deg, #08232eee, #07151fee);
  --plus-progress-fill-background: linear-gradient(90deg, #008ea3, #00e5ff);
  --plus-constrained-progress-background: linear-gradient(135deg, #008ea3cc, #00e5ff70);
}
```

### Change fonts and card shape

Fonts must already be available to OBS's embedded browser. The overlay does not
load remote fonts.

```css
:root {
  --plus-font-family: Georgia, serif;
  --plus-card-radius: 18px;
}
```

### Widen the portrait goal spine

```css
:root {
  --plus-portrait-progress-width: 18px;
}
```

### Remove ruler ticks or the complete ruler

```css
:root {
  --plus-progress-ticks: none;
}
```

To remove the horizontal ruler or portrait spine entirely:

```css
.rail-wrap {
  display: none;
}
```

Square is already rail-free.

### Restyle constrained spatial progress

This affects constrained horizontal and portrait modes only. Square remains
neutral.

```css
:root {
  --plus-constrained-progress-background:
    linear-gradient(135deg, #0a687acc, #19d3f070);
  --plus-constrained-progress-shadow: 0 0 28px #19d3f066;
}
```

### Keep metadata in a constrained square

OBS Custom CSS loads after the shipped rules, so a matching media query can
override an automatic mode:

```css
@media (min-aspect-ratio: 751 / 1000) and
       (max-aspect-ratio: 1332 / 1000) and
       (max-width: 139px) {
  .overlay-card {
    grid-template-rows: auto 1fr auto;
  }

  .header-row,
  .footer-row {
    display: flex;
  }
}
```

Repeat the query with `(max-height: 139px)` if the height, rather than width,
causes the constrained square.

### Hide selected metadata

```css
.month-label,
.updated-text {
  display: none;
}
```

## OBS tips

- Start with **800 × 140** for horizontal, **300 × 300** for square, or
  **300 × 600** for portrait. Scale the Browser Source as a scene item after
  choosing its composition.
- Keep `html` and `body` transparent unless you intentionally want a
  full-source backdrop.
- Prefer custom properties over copying shipped declarations. Use documented
  classes for visibility or structural overrides.
- OBS injects Custom CSS after the page stylesheet. Avoid `!important` unless
  intentionally overriding the HTML `hidden` attribute.
- Use **Refresh cache of current page** after a deployment or CSS change if OBS
  still shows older assets. A harmless URL value such as `&v=2` also forces a
  new page cache key.

See the official [OBS Browser Source
documentation](https://obsproject.com/kb/browser-source) for Browser Source
properties and cache controls.
