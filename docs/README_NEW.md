# Polygon Studio

A modern, **fully modular** polygon drawing and manipulation tool built with **Web Components**, Material Design 3, and vanilla JavaScript. This application demonstrates best practices in modular architecture with small, manageable, and reusable components.

## 🎯 Key Highlights

- ✨ **Web Components**: Built with native Custom Elements API
- 🧩 **Highly Modular**: Each component is self-contained and focused
- 📦 **Easy to Maintain**: No component exceeds 200 lines
- 🔌 **Event-Driven**: Decoupled architecture using EventBus
- 🎨 **Material Design 3**: Beautiful, modern UI
- 📝 **Well Documented**: Complete architecture and component documentation

## 🏗️ Modular Architecture

This application follows a **component-based architecture** where each piece is:
- **Small**: No file exceeds 200 lines of code
- **Focused**: Single responsibility per component
- **Reusable**: Can be used independently
- **Maintainable**: Easy to understand and modify

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        app.js (Main)                        │
│  Coordinates all components, controllers, and services     │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
    ┌──────▼──────┐      ┌─────▼─────┐      ┌──────▼──────┐
    │  Components │      │Controllers│      │  Services   │
    │   (UI Layer)│      │ (Business)│      │  (Data)     │
    └─────────────┘      └───────────┘      └─────────────┘
           │                    │                    │
    ┌──────▼────────────────────▼────────────────────▼──────┐
    │                    EventBus (Utils)                    │
    │          Centralized event communication system        │
    └────────────────────────────────────────────────────────┘
```

### Module Organization

**8 Web Components** - Each handles a specific UI section:
- `app-header` - Application header with branding
- `canvas-toolbar` - Canvas information display
- `polygon-canvas` - Canvas wrapper component
- `draw-tools-section` - Drawing and shape tools
- `customize-section` - Color customization
- `file-operations-section` - Save/load/export
- `actions-section` - Delete and clear actions
- `stats-section` - Real-time statistics

**1 Controller** - Business logic:
- `PolygonCanvasController` - Canvas and polygon management

**2 Services** - Data operations:
- `StorageService` - LocalStorage operations
- `FileService` - File import/export

**1 Model** - Data structure:
- `Polygon` - Polygon data model with methods

**1 Utility** - Shared functionality:
- `EventBus` - Event communication system

📖 **Detailed Documentation:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - Complete architecture guide
- [COMPONENT_INDEX.md](COMPONENT_INDEX.md) - Component reference

## ✨ Features

### Drawing Tools
- 🎨 **Point-by-Point Drawing**: Click to add vertices, right-click to undo
- 📐 **Preset Shapes**: Instant triangle, rectangle, hexagon creation
- 🎲 **Random Generation**: Create random polygons with 3-7 sides
- ✅ **Smart Completion**: Visual feedback showing when polygon is ready

### Interaction
- 🖱️ **Drag & Drop**: Click and drag any polygon
- 🎯 **Selection**: Visual selection with highlighted vertices
- 👆 **Touch Support**: Full mobile device compatibility
- 🎨 **Live Preview**: See polygon preview while drawing

### Customization
- 🎨 **Fill Color**: Customizable interior color
- 🖊️ **Stroke Color**: Customizable border color
- 🌈 **Color Picker**: Native HTML5 color selection

### Data Management
- 💾 **Local Storage**: Auto-save to browser storage
- 📥 **Import**: Load JSON polygon files
- 📤 **Export**: Download polygons as JSON
- 🔄 **State Management**: Maintains drawing state across sessions

### Statistics
- 📊 **Polygon Count**: Real-time count display
- 🔢 **Vertex Count**: Total vertices across all polygons
- 📈 **Live Updates**: Automatic stats refresh

## 🚀 Getting Started

### Prerequisites

- **Node.js** v14+ (v24.11.1 recommended)
- **npm** v6+ (v11.6.2 recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to directory
cd ReachabilityTracking

# Install dependencies
npm install
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Alternative start command
npm start
```

Opens at `http://localhost:3000` with hot module replacement (HMR).

### Building

```bash
# Build optimized production bundle
npm run build
```

Creates production-ready files in `dist/` directory.

### Preview Production

```bash
# Preview production build locally
npm run preview

# Alternative serve command
npm run serve
```

### Maintenance

```bash
# Clean build cache
npm run clean

# Complete cleanup (dist + node_modules)
npm run clean:all

# Reinstall everything
npm run reinstall
```

## 📖 Usage Guide

### Drawing a Custom Polygon

1. Click **"Draw from Points"** button
2. Click on canvas to add vertices (minimum 3 points)
3. Right-click to remove last point
4. Click **"Complete Polygon"** when ready
5. Or click **"Cancel Drawing"** to abort

### Creating Preset Shapes

- **Triangle**: Click "Triangle" button
- **Rectangle**: Click "Rectangle" button  
- **Hexagon**: Click "Hexagon" button
- **Random**: Click "Random" button for surprise shapes

### Manipulating Polygons

- **Select**: Click any polygon
- **Move**: Drag selected polygon
- **Delete**: Select polygon, then click "Delete Selected"
- **Clear All**: Click "Clear All" (with confirmation)

### Color Customization

1. Use **Fill Color** picker for interior color
2. Use **Stroke Color** picker for border color
3. New polygons will use selected colors

### Saving Your Work

- **Save**: Stores to browser localStorage
- **Load**: Restores from localStorage
- **Export JSON**: Downloads as file
- **Import**: Click "Load", select JSON file

## 🗂️ Project Structure

```
src/
├── app.js                          # Main application entry
├── components/                      # Web Components (UI)
│   ├── AppHeader.js                # ~60 lines
│   ├── CanvasToolbar.js            # ~120 lines
│   ├── PolygonCanvas.js            # ~45 lines
│   ├── DrawToolsSection.js         # ~125 lines
│   ├── CustomizeSection.js         # ~90 lines
│   ├── FileOperationsSection.js    # ~90 lines
│   ├── ActionsSection.js           # ~70 lines
│   └── StatsSection.js             # ~110 lines
├── controllers/                     # Business Logic
│   └── PolygonCanvasController.js  # ~420 lines
├── models/                          # Data Models
│   └── Polygon.js                  # ~110 lines
├── services/                        # Services
│   ├── StorageService.js           # ~50 lines
│   └── FileService.js              # ~75 lines
├── utils/                           # Utilities
│   └── EventBus.js                 # ~45 lines
└── styles.css                       # Global styles

Total: ~1,400 lines across 16 files
Average: ~88 lines per file
```

## 🎨 Technologies

- **Web Components**: Native Custom Elements API
- **ES6+ Modules**: Modern JavaScript with import/export
- **Shadow DOM**: Style and DOM encapsulation
- **Material Design 3**: Google's latest design system
- **Material Web Components**: Official MD3 components
- **HTML5 Canvas**: High-performance rendering
- **Vite 4.5**: Lightning-fast build tool
- **EventBus Pattern**: Decoupled component communication

## 🌐 Browser Support

- **Chrome/Edge**: 67+ (Custom Elements v1)
- **Firefox**: 63+ (Custom Elements v1)
- **Safari**: 10.1+ (Custom Elements v1)
- **Mobile**: Full touch support on all modern browsers

## 🚢 Deployment

After building with `npm run build`, deploy the `dist/` folder:

**Vercel**
```bash
npm i -g vercel
vercel
```

**Netlify**
```bash
# Drag and drop dist/ folder to Netlify
```

**GitHub Pages**
```bash
# Push dist/ to gh-pages branch
npm run build
git subtree push --prefix dist origin gh-pages
```

**AWS S3**
```bash
# Upload dist/ contents to S3 bucket
aws s3 sync dist/ s3://your-bucket-name
```

## 🔧 Adding New Components

The modular architecture makes it easy to add new features:

1. **Create Component File**
   ```javascript
   // src/components/MyComponent.js
   export class MyComponent extends HTMLElement {
       constructor() {
           super();
           this.attachShadow({ mode: 'open' });
       }
       // ...component code
   }
   customElements.define('my-component', MyComponent);
   ```

2. **Import in app.js**
   ```javascript
   import './components/MyComponent.js';
   ```

3. **Use in HTML**
   ```html
   <my-component></my-component>
   ```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed guidelines.

## 📚 Additional Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete architecture documentation
- **[COMPONENT_INDEX.md](COMPONENT_INDEX.md)** - Component reference guide
- **[FEATURES.md](FEATURES.md)** - Detailed feature documentation
- **[DRAWING_GUIDE.md](DRAWING_GUIDE.md)** - Drawing tools guide
- **[LAYOUT_GUIDE.md](LAYOUT_GUIDE.md)** - Layout and styling guide

## 🤝 Contributing

This project demonstrates modular architecture best practices. When contributing:

1. Keep components under 200 lines
2. Use EventBus for component communication
3. Follow single responsibility principle
4. Document your components
5. Add JSDoc comments

## 📄 License

MIT License - Feel free to use this code for learning or your own projects!

## 🙏 Acknowledgments

- **Material Design 3** by Google
- **Web Components** standards by W3C
- **Vite** by Evan You and team

---

**Built with ❤️ using modern web standards and modular architecture principles.**
