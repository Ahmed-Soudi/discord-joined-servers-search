# Discord Joined Servers Search

A lightweight, **Chrome Manifest V3 extension** for quickly finding and switching between **Discord servers you have already joined** on [Discord Web](https://discord.com/app).

**This extension searches only servers you are a member of.** It does **not** search channels, discover public servers you have not joined, or search Discord's public server directory. It is not affiliated with Discord.

## What it does

- Automatically displays names of joined servers from Discord's already-loaded client data.
- Searches **joined server names only**, with keyboard navigation and one-click switching.
- Lists servers in Discord's icon order, matching each name to its server ID and removing duplicates.
- Offers a collapsible sidebar, manual refresh, and **Copy status** diagnostics.
- Does **not** require you to click, hover over, or manually inspect each server to load its name.
- Does **not** require a bot, API token, or another service.

## Install (unpacked)

1. Download and extract the release ZIP.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Remove the previous **Discord Server Names & Search v7** installation to avoid two sidebars appearing.
4. Click **Load unpacked** and select the extracted `discord-joined-servers-search` folder.
5. Open or refresh `https://discord.com/channels/@me`.
6. Use the **Joined servers · v7** panel to find a server by name.

> The extension version is **7.0.1**, a branding-only update to the working v7.0.0 release. The GuildStore/React discovery logic and internal communication IDs remain unchanged.

## Privacy & permissions

- `storage`: saves only whether the sidebar is enabled or expanded.
- Site access: `https://discord.com/channels/*` only.
- Reads the joined-server metadata Discord has already loaded in your browser.
- No tracking, analytics, external network calls, API token, password, or bot permissions.
- Server names are **not** written to extension storage.

## What it does *not* do

- Search channel names or messages.
- Search or recommend servers you haven't joined.
- Join or leave servers on your behalf.
- Bypass server access permissions.

## Development and tests

This is a plain JavaScript/CSS/HTML repository; there is no build step.

```bash
node --check page-bridge.js
node --check sidebar.js
node --check popup.js
node tests/test_early_start.cjs
# Optional: requires Playwright + browser installation
python tests/test_extension.py
```

The local browser test simulates 86 joined servers and verifies server names and search behavior. Discord's GuildStore and React internals are undocumented and may change, so tests cannot guarantee compatibility with all future Discord versions.

### Implementation

The read-only page-world adapter (`page-bridge.js`) retrieves GuildStore metadata from the page's existing loaded client code, with a React component data fallback. The isolated-world `sidebar.js` creates the UI. All network access is handled by Discord itself; this extension makes none.

The `dsn-v7-*` CSS classes and `discord-server-names-v7:*` message identifiers are intentionally unchanged to preserve the confirmed v7 behavior.

## Sources

- [Vencord: Webpack Modules & Chunks](https://docs.vencord.dev/discord-code/modules/)
- [Vencord: GuildStore types](https://github.com/Vendicated/Vencord/blob/main/packages/discord-types/src/stores/GuildStore.d.ts)
- [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)

## License

MIT. See [LICENSE](LICENSE).
"# discord-joined-servers-search" 
