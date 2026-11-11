# Discord Joined Servers Search

A small, draggable **Chrome Manifest V3 extension** that searches **only the Discord servers you've already joined** in [Discord Web](https://discord.com/channels/@me). It never searches channels, messages, or servers you have not joined.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Search bar by default.** Type to see matching joined servers and click a result to switch to that server. Clear your query to return to the compact search field.
- **Draggable window.** Drag the dotted handle at the left edge of the search field, or drag the full-list title bar. The position is saved via `chrome.storage.local` and restored when Discord is reopened, including after restarting Chrome.
- **Unobtrusive default placement.** The compact bar starts at the **upper-left empty Discord title strip** near the server icons (`left: 76px; top: 0px` in the page viewport). The expanded-list default retains the previous location (`left: 76px; top: 75px`). You can drag either layout anywhere within the visible browser viewport.
- **Optional full list.** Click the list toggle at the right end of the search field or enable **Show full server list by default** in the extension popup. Your preference is saved. Search results still appear automatically while typing, regardless of that setting.
- **Position reset.** Open the extension popup and choose **Reset window position** to return to the appropriate default for your chosen layout.
- **All joined server names without clicking icons.** The proven v7 client-side GuildStore discovery code is unchanged, including the React-data fallback. IDs keep server names correctly matched and deduplicated.
- **Search shortcuts:** `↑` / `↓` to select, `Enter` to open the selected server, `Esc` to clear your search. The full-list view also has **Refresh** and **Copy status** controls.

## Install or upgrade

1. Download and extract `discord-joined-servers-search-v7.1.0.zip`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Remove the older installed version of this extension to avoid duplicate overlays.
4. Click **Load unpacked** and choose the extracted `discord-joined-servers-search` folder.
5. Open or refresh [Discord Web](https://discord.com/channels/@me).
6. Search from the compact field in the top-left, or toggle the full server list if you prefer browsing.

The extension is published here as source for unpacked installation; it is not a Chrome Web Store listing.

## Settings

| Setting | Default | Persistence |
| --- | --- | --- |
| Extension enabled | On | `chrome.storage.local` |
| Full server list shown automatically | Off (search field only) | `chrome.storage.local` |
| Panel position | Compact: `76px,0px` / Full: `76px,75px` | Saved when dragged; reset in popup |

The compact bar is moved to the empty top row so it doesn't cover channel names at startup. The panel automatically clamps itself inside the browser viewport after a window resize or while opening a long list. Its saved position is unchanged by these temporary size adjustments.

## Privacy and scope

- **Only joined servers** already available in your Discord client are searched.
- Does **not** index Discord channels, messages, public directories, or servers you're not a member of.
- Makes no network requests of its own; there is no external service, analytics, bot, or Discord login token.
- Stores only display settings and the window position, **never server names or guild data**.
- Page access is restricted to `https://discord.com/channels/*`; the only requested browser permission is `storage`.
- Unofficial community extension; not endorsed by or affiliated with Discord.

## Developer notes

No build step or dependencies for the extension. The working v7 name-discovery bridge (`page-bridge.js`) and its `discord-server-names-v7:*` message identifiers deliberately remain unchanged; the filename and internal identifiers are not visible in the interface.

Run the JavaScript syntax and the mocked Chromium tests:

```sh
node --check page-bridge.js
node --check sidebar.js
node --check popup.js
node tests/test_early_start.cjs
python tests/test_extension.py
python tests/test_ui_7_1.py
```

The Playwright tests cover 86 named servers, multiple GuildStore shapes, delayed client initialization, React fallback, compact search, drag positioning, storage restoration, saved full-list preference, and small-viewport clamping. They use a simulated Discord page and do not constitute a live Discord compatibility guarantee.

### Source references

- [Vencord Webpack documentation](https://docs.vencord.dev/discord-code/modules/)
- [Vencord GuildStore types](https://github.com/Vendicated/Vencord/blob/main/packages/discord-types/src/stores/GuildStore.d.ts)
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

## License

MIT. See [LICENSE](LICENSE).

## Version 7.1.1

Restores the Chrome extension name to **Discord Joined Servers Search**. The floating in-page panel intentionally keeps the shorter **Joined Servers Search** title. All v7.1.0 functionality is unchanged.
