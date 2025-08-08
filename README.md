# MergeX

Smart tab manager for Chrome: merge windows, prevent duplicate tabs, sort and group by domain/time — all in a clean, fast UI.

## Features
- Merge tabs from all windows (preserves groups), remove duplicates
- Prevent duplicate tabs (same-window scope, closes the previous one)
- Sort by domain, Group by domain or last access time, Ungroup all
- Quick toggles in popup; read-only settings overview with delete

![example](./image.png)

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
