# Polygon Visualizer

A modern web application for creating, dragging, and visualizing polygons with Material Design 3 styling.

## Features

- ✨ Create and manipulate polygons on an interactive canvas
- 🎨 Material Design 3 UI components with sidebar toolbar
- 🖱️ Drag and drop functionality
- 🎲 Multiple shape types (triangle, rectangle, hexagon, random)
- 🎨 Customizable fill and stroke colors
- 💾 Save/Load functionality with local storage
- 📥 Import/Export polygons as JSON files
- 📱 Responsive design
- 📱 Touch support for mobile devices

## Technologies

- **ES6+ JavaScript** - Modern JavaScript with modules
- **Vite 4.5** - Fast build tool and dev server
- **Material Web Components** - Material Design 3 components
- **HTML5 Canvas** - For polygon rendering

## Prerequisites

- Node.js v14+ (v24.11.1 recommended)
- npm v6+ (v11.6.2 recommended)

## Getting Started

### Installation

```bash
npm install
```

### Available Scripts

#### Development

```bash
# Start development server (recommended)
npm run dev

# Alternative start command
npm start
```

Both commands start the Vite development server at `http://localhost:3000` with hot module replacement (HMR).

#### Building

```bash
# Build for production
npm run build
```

Creates an optimized production build in the `dist/` directory.

#### Preview Production Build

```bash
# Preview the production build
npm run preview

# Alternative serve command
npm run serve
```

Starts a local server to preview the production build.

#### Maintenance

```bash
# Clean build cache and Vite cache
npm run clean

# Remove everything (dist, node_modules)
npm run clean:all

# Clean and reinstall dependencies
npm run reinstall

# Linting (placeholder)
npm run lint

# Formatting (placeholder)
npm run format
```

## Usage

### Drawing Polygons

1. **Draw Polygon** - Creates a triangle at the center
2. **Rectangle** - Creates a rectangular shape
3. **Triangle** - Creates a triangular shape
4. **Hexagon** - Creates a hexagonal shape
5. **Random** - Generates a random polygon with 3-7 sides

### Customization

- **Fill Color** - Choose the interior color for new polygons
- **Stroke Color** - Choose the border color for new polygons

### File Operations

- **Save** - Store all polygons in browser's local storage
- **Load** - Restore polygons from local storage or import from JSON file
- **Export JSON** - Download all polygons as a JSON file

### Actions

- **Delete Selected** - Remove the currently selected polygon
- **Clear All** - Remove all polygons from canvas (with confirmation)

### Interaction

1. **Select** - Click on any polygon to select it
2. **Drag** - Click and drag selected polygons to move them
3. **Deselect** - Click on empty canvas to deselect

## Project Structure

```
ReachabilityTracking/
├── src/
│   ├── main.js              # Application entry point
│   ├── polygon-canvas.js    # Polygon and canvas logic
│   └── styles.css           # Material Design 3 styles
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── FEATURES.md              # Detailed feature documentation
└── README.md                # This file
```

## Deployment

After building with `npm run build`, deploy the `dist/` folder to any static hosting service:

- **Vercel**: `npm i -g vercel && vercel`
- **Netlify**: Drag and drop `dist/` folder
- **GitHub Pages**: Push `dist/` to gh-pages branch
- **AWS S3**: Upload `dist/` contents to S3 bucket

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers with touch support

## Additional Documentation

See [FEATURES.md](./FEATURES.md) for detailed feature documentation and usage tips.

## License

MIT
