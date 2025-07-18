# MergeX

> A comprehensive tab management extension for Chrome, built with Vite + Vanilla JS using Manifest V3.

## Features

- 🔄 **Merge Tabs**: Combine tabs from multiple windows into one and remove duplicates
- 📊 **Smart Sort**: Organize tabs by domain name for better workflow
- 👥 **Intelligent Grouping**: Auto-group tabs by domain name or access time
- 🚫 **Duplicate Prevention**: Automatically prevent duplicate tabs from being opened
- 🔍 **Site-Specific Settings**: Configure special handling for specific domains
- 🎨 **Modern UI**: Clean, intuitive interface with one-click operations

![example](./image.png)

## Installation

1. Clone the repository
```bash
git clone https://github.com/abcdlsj/mergex.git
cd mergex
```

2. Install dependencies (Node.js >= 14 required)
```bash
npm install
```

3. Build the extension
```bash
npm run build
```

4. Load in Chrome
- Open Chrome and navigate to `chrome://extensions/`
- Enable "Developer mode" in the top right
- Click "Load unpacked" and select the `build` directory from the project

## Usage

1. Click the MergeX icon in the browser toolbar
2. The popup panel provides several powerful functions:
   - **Merge Tabs**: Combine all tabs from different windows and remove duplicates
   - **Sort by Domain**: Organize tabs by domain name in the current window
   - **Group by Time**: Create tab groups based on when tabs were last accessed
   - **Group by Domain**: Create tab groups based on domain names
   - **Ungroup All**: Remove all tab groupings
   
3. Settings (click the Settings button):
   - Enable/disable automatic duplicate tab prevention
   - Add site-specific settings for special URL handling

## Development

### Development mode

```bash
npm run dev
```
This will start a development server with hot module replacement, allowing you to see changes in real-time.

### Build for production

```bash
npm run build
```
Creates an optimized production build in the `build` directory.

### Package for distribution

```bash
npm run zip
```
Creates a ZIP file ready for submission to the Chrome Web Store.

## How It Works

MergeX uses Chrome's extension APIs to provide powerful tab management features:

1. **Duplicate Prevention**: The background service worker monitors tab updates and automatically closes duplicate tabs, with configurable settings per domain.

2. **Tab Merging**: Combines tabs from all windows into the current window, removing duplicates and organizing them efficiently.

3. **Tab Sorting**: Organizes tabs by domain name to keep related content together.

4. **Tab Grouping**: Creates color-coded tab groups based on either domain names or last access time, making it easier to manage many open tabs.

## Tech Stack

- Vite - Fast build tooling
- Vanilla JavaScript - No framework dependencies
- Chrome Extension Manifest V3 - Latest extension platform
- CRXJS - Streamlined extension development

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Author

- **abcdlsj** - [GitHub](https://github.com/abcdlsj)

## Acknowledgments

- [create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext) - Project template
