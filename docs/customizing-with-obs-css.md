# Customize the overlay with OBS CSS

OBS Browser Sources can apply CSS on top of a page without changing the
deployed overlay. Open the Browser Source properties and paste overrides into
the **Custom CSS** field.

The supported customization surface consists of the custom properties,
classes, and render states in this guide. Element IDs, undeclared properties,
and other stylesheet details are internal and may change.

## Quick start

Change the accent colors by pasting this into **Custom CSS**:

```css
:root {
  --plus-color-accent: #00e5ff;
  --plus-color-accent-bright: #b8f8ff;
}
```

Click **OK** to apply it. If OBS retains older page assets, reopen the source
properties and select **Refresh cache of current page**.

## Custom properties

Override custom properties on `:root`. These are the preferred hooks because
they preserve the overlay's layout and state behavior.

| Property | Default | Purpose |
| --- | --- | --- |
| `--plus-font-family` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Body and interface font stack |
| `--plus-heading-font-family` | `"Arial Narrow", "Roboto Condensed", Impact, ui-sans-serif, system-ui, sans-serif` | Overlay title font stack |
| `--plus-color-text` | `#f7f5ff` | Primary text |
| `--plus-color-muted` | `#b8b2c8` | Secondary labels and footer text |
| `--plus-color-accent` | `#a970ff` | Default progress and status accent |
| `--plus-color-accent-bright` | `#c8a7ff` | Highlighted accent text and edges |
| `--plus-color-success` | `#73e6b1` | Completed-goal state |
| `--plus-color-warning` | `#ffb36b` | Stale and error states |
| `--plus-overlay-padding` | `6px` | Transparent space around the card |
| `--plus-card-width` | `920px` | Maximum card width |
| `--plus-card-height` | `128px` | Card height at the native viewport |
| `--plus-card-min-height` | `116px` | Minimum card height |
| `--plus-card-padding` | `15px 19px 12px` | Card content padding |
| `--plus-card-border` | `1px solid color-mix(in srgb, var(--plus-color-accent) 34%, #373044)` | Complete card border declaration |
| `--plus-card-radius` | `10px 3px 10px 3px` | Card corner radii |
| `--plus-card-background` | `linear-gradient(100deg, #211a31f2 0%, #181521ed 45%, #121019f2 100%)` | Card background |
| `--plus-card-texture` | `repeating-linear-gradient(108deg, transparent 0 34px, #ffffff05 35px 36px)` | Decorative card overlay; use `none` to remove it |
| `--plus-card-shadow` | `0 14px 35px #08060d73, inset 0 1px 0 #ffffff12` | Outer and inset card shadows |
| `--plus-progress-height` | `12px` | Progress rail height |
| `--plus-progress-track-border` | `1px solid #655a73` | Complete rail border declaration |
| `--plus-progress-track-background` | `#09080da6` | Unfilled rail background |
| `--plus-progress-fill-background` | `linear-gradient(90deg, #7644c2, var(--plus-color-accent) 72%, #c5a0ff)` | Active progress fill |
| `--plus-progress-fill-completed-background` | `linear-gradient(90deg, #2da673, var(--plus-color-success))` | Completed progress fill |
| `--plus-progress-fill-shadow` | `0 0 12px color-mix(in srgb, var(--plus-color-accent) 42%, transparent)` | Active progress glow |
| `--plus-progress-ticks` | `repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), #f5efff29 calc(10% - 1px) 10%)` | Tick overlay; use `none` to remove it |
| `--plus-progress-transition` | `width 650ms cubic-bezier(0.22, 1, 0.36, 1)` | Progress-fill animation |

## Element classes

Use classes when a custom property does not cover the change, such as hiding
or repositioning an element. The class names below are supported
customization hooks.

### Shell

| Class | Element |
| --- | --- |
| `.overlay` | Full Browser Source canvas and state-bearing root |
| `.overlay-card` | Visible overlay card |

### Header

| Class | Element |
| --- | --- |
| `.header-row` | Complete header row |
| `.brand-lockup` | Plus mark, title, and month group |
| `.plus-mark` | Decorative plus symbol |
| `.overlay-title` | “Plus Program” heading |
| `.month-label` | Current UTC month |
| `.state-badge` | Live, completed, stale, or message-state badge |

### Progress

| Class | Element |
| --- | --- |
| `.progress-view` | Score and progress rail container |
| `.score-row` | Score and goal-level row |
| `.score` | Current and target point group |
| `.score-divider` | Slash between current and target points |
| `.score-unit` | “Plus Points” label |
| `.goal-level` | L1 or L2 badge |
| `.rail-wrap` | Progress rail wrapper |
| `.progress-rail` | Progress track |
| `.progress-fill` | Filled portion of the track |
| `.rail-ticks` | Ten-percent tick overlay |
| `.target-bracket` | End-of-target marker |

### Messages

| Class | Element |
| --- | --- |
| `.message-view` | Loading, setup, and error message container |
| `.message-title` | Message heading |
| `.message-body` | Message detail |

### Footer

| Class | Element |
| --- | --- |
| `.footer-row` | Complete status footer |
| `.status-text` | Goal distance or connection status |
| `.updated-text` | Last successful update age |
| `.refresh-button` | Manual refresh control |

## Render states

The root is `.overlay[data-state="STATE"]`. Target a whole state or combine
the state selector with a documented class.

| State | Meaning |
| --- | --- |
| `loading` | Initial Twitch request is in progress |
| `success` | Current progress is live and below the target |
| `completed` | Current progress has reached or exceeded the target |
| `stale` | Cached progress is shown after a transient refresh failure |
| `error` | No valid progress is available after an error |
| `missing_channel` | The Browser Source URL has no channel query value |
| `channel_not_found` | Twitch did not find the requested login |
| `widget_unavailable` | The Plus goal is not publicly shared |
| `plus_status_null` | Twitch returned no public Plus status |
| `unknown_widget_setting` | Twitch returned an unsupported goal setting |

For example:

```css
.overlay[data-state="completed"] .overlay-title {
  color: var(--plus-color-success);
}
```

## Examples

Each example is independent and can be pasted as-is. Combine only the
declarations you want.

### Change the color theme

```css
:root {
  --plus-color-accent: #00e5ff;
  --plus-color-accent-bright: #b8f8ff;
  --plus-card-background: linear-gradient(100deg, #08232eee, #07151fee);
  --plus-progress-fill-background: linear-gradient(90deg, #008ea3, #00e5ff);
}
```

### Change fonts and card shape

Fonts must already be available to OBS's embedded browser. This overlay does
not load remote fonts.

```css
:root {
  --plus-font-family: Georgia, serif;
  --plus-heading-font-family: Georgia, serif;
  --plus-card-radius: 18px;
}
```

### Create a minimal rail view

This layout is intended for a shorter custom Browser Source height. Test it in
the target scene before going live.

```css
.header-row,
.score-row,
.footer-row {
  display: none;
}

.overlay-card {
  grid-template-rows: 1fr;
  min-height: 36px;
  height: 36px;
  padding: 10px;
}

.progress-view {
  width: 100%;
  margin: 0;
}
```

### Hide selected metadata

```css
.month-label,
.score-unit,
.updated-text {
  display: none;
}
```

### Emphasize stale and error states

```css
.overlay[data-state="stale"] .overlay-card,
.overlay[data-state="error"] .overlay-card {
  --plus-card-border: 2px solid var(--plus-color-warning);
}
```

## OBS tips

- Keep the Browser Source at **800 × 140** for the default layout and scale it
  as a scene item. Changing the viewport can trigger the compact responsive
  layout.
- Keep `html` and `body` transparent unless you intentionally want a
  full-source backdrop. The shipped page and OBS's default Browser Source CSS
  are transparent.
- Prefer custom properties over copying shipped declarations. For direct class
  overrides, use the documented selector shown in the reference.
- OBS injects Custom CSS after the page finishes loading, so these examples
  override equally specific shipped rules. Avoid `!important` unless you are
  intentionally overriding the HTML `hidden` attribute.
- Use **Refresh cache of current page** after a deployment or CSS change if OBS
  still shows older assets. A harmless URL value such as `&v=2` can also force
  a new page cache key.

See the official [OBS Browser Source
documentation](https://obsproject.com/kb/browser-source) for Browser Source
properties and cache controls.
