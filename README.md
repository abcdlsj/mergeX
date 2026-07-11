# MergeX

Quiet tab housekeeping for Chrome: duplicate tabs are redirected automatically, while deliberate cleanup stays one click away.

## Features

- Automatically redirect duplicate tabs to the copy that is already open
- Merge tabs from all windows while preserving groups and removing exact duplicates
- Sort by website, group by website or age, and clear groups
- Create per-site query/anchor rules directly from the popup, with full management in Preferences

## Quick start

```bash
git clone https://github.com/abcdlsj/mergex.git
cd mergex
npm install
npm run build
```

Load in Chrome → `chrome://extensions/` → enable Developer Mode → Load unpacked → select `build`.

## Development

```bash
npm run dev   # HMR dev
npm run build # production build
npm run zip   # package for store
```

## License

MIT — see [LICENSE](LICENSE).
