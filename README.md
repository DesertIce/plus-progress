# Twitch Plus Program Progress Overlay

A compact, transparent progress overlay for the Twitch Plus Program. It runs as a static site in an OBS Browser Source, reads a broadcaster's publicly shared Plus goal directly from Twitch, and keeps the last valid monthly value visible when Twitch is temporarily unavailable.

No Streamer.bot instance, backend, proxy, OAuth token, account, or secret is required.

> [!WARNING]
> Twitch's Plus Program GraphQL API is undocumented and unsupported. Twitch can change the endpoint, required headers, operations, response fields, or browser access without notice. See [Maintenance](#maintenance) for the isolated integration points.

## Deploy with GitHub Pages

1. Create the repository in the `desertice` GitHub account and add these files.
2. Push the repository to GitHub under `desertice`.
3. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
4. Push to `main` or run **Deploy static overlay to Pages** manually from the Actions tab.
5. Wait for the `github-pages` environment deployment to finish.

The workflow tests the project and uploads only `site/`. It deploys from `main`. If the repository uses another default branch, change this line in `.github/workflows/pages.yml`:

```yaml
branches: [main]
```

The deployed URL has this form:

```text
https://desertice.github.io/plus-progress/?channel=<twitch-login>
```

All site assets use relative URLs, so GitHub project subpaths work without configuration.

## Add to OBS

1. In OBS, add a **Browser** source.
2. Enter the GitHub Pages URL and append `?channel=<twitch-login>`.
3. Set the source size to **800 × 140**.
4. Leave custom CSS empty unless the scene needs an additional transform.

The page background is transparent. The channel value is trimmed, a leading `@` is removed, and the login is matched case-insensitively.

### Recommended output sizing

Keep the Browser Source resolution at its native **800 × 140** for every output resolution, then scale the source as a scene item in OBS. This keeps the overlay layout consistent instead of causing it to reflow.

| OBS output canvas | Browser Source resolution | Approximate displayed size | Scene-item scale |
| --- | --- | --- | --- |
| 1280 × 720 (720p) | 800 × 140 | 533 × 93 | 66.7% |
| 1920 × 1080 (1080p) | 800 × 140 | 800 × 140 | 100% |
| 2560 × 1440 (2K/QHD) | 800 × 140 | 1067 × 187 | 133.3% |

These sizes preserve the overlay's relative footprint from the 1080p baseline. Fine-tune its scale and position to suit the rest of the scene.

Example:

```text
https://desertice.github.io/plus-progress/?channel=somechannel
```

## Local preview

Run a static server from the project root:

```bash
python3 -m http.server 8080 --directory site
```

Then open:

```text
http://localhost:8080/?channel=<twitch-login>
```

Opening `site/index.html` directly may work in some browsers, but a local HTTP server most closely matches GitHub Pages and OBS.

## Tests

Node.js 20 or newer is recommended. There are no package dependencies to install.

```bash
npm test
```

The deterministic tests use Node's built-in test runner and mocked `fetch`; they do not require Twitch to be online.

## How progress is calculated

The overlay resolves the configured login to a channel ID once per page load. It then refreshes Plus Program status immediately and every 10 minutes.

- The current period is selected with the UTC year and month, regardless of response order.
- A missing current-month entry counts as 0 points.
- `widgetSetting` chooses the displayed L1 or L2 threshold. The broadcaster's `level` is not used as the goal selector.
- Displayed points may exceed the target; only the visual rail is clamped to 100%.
- “Updated” shows “just now” for the first minute, then counts minutes since the local successful fetch completion time because Twitch can return a null `updatedAt`.
- A request is abandoned after about 10 seconds, and overlapping refreshes are suppressed.

Only a fully validated result is cached. Cache entries are versioned and keyed by normalized channel login. Following a transient failure, a valid cache entry for the current UTC month appears with a visible **Stale** badge and its last successful update time.

## Troubleshooting

### Channel needed

Add `?channel=<twitch-login>` to the URL. For an existing query string, use `&channel=<twitch-login>`.

### Channel not found

Check that the URL contains the channel's Twitch login, not its display name with spaces or a full Twitch URL.

### Goal not publicly shared

The broadcaster may not be in the Plus Program, may have disabled the Plus widget, or may need to enable and publicly share their Plus Program goal on Twitch.

### Stale value

The last valid value is being retained because Twitch could not be reached or returned an API error. The update time shows when that value was fetched successfully. Use **Refresh** to retry immediately; automatic refresh continues every 10 minutes.

### OBS still shows an older deployment

Refresh the Browser Source cache in OBS. If needed, add or increment a harmless cache-busting query value:

```text
https://desertice.github.io/plus-progress/?channel=somechannel&v=2
```

## Maintenance

All undocumented Twitch-specific behavior is isolated in [`site/twitch-api.js`](site/twitch-api.js):

- Endpoint: `https://gql.twitch.tv/gql`
- Operation names: `ChannelId` and `PartnerPlusPublicQuery`
- Header: the public Twitch web-client `Client-ID`
- Channel fields: `id`, `login`, and `displayName`
- Plus fields: `l1Threshold`, `l2Threshold`, `level`, `canShowWidget`, `subPoints`, and `widgetSetting`

If Twitch changes its private web API, update that module and its mocked tests first. Do not add OAuth credentials as a workaround unless the architecture and security model are intentionally redesigned.

## Privacy and security

- The overlay sends the configured public channel login to Twitch's GraphQL endpoint.
- It stores only normalized progress data in the local browser/OBS profile.
- It includes no analytics, trackers, third-party runtime dependencies, or external fonts.
- No OAuth token is required. Do not add client secrets, access tokens, or broadcaster credentials.
- GitHub Pages source, workflow configuration, and the public Twitch web-client ID are visible to anyone who can access the repository or site.

## License

MIT — see [`LICENSE`](LICENSE).
