# Quick Start Guide - Polygon Studio

Get up and running with the modular Polygon Studio in 5 minutes!

## 🚀 Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open browser to http://localhost:3000
```

That's it! The app is now running.

## 🎨 First Steps

### Create Your First Polygon

**Option 1: Use Preset Shapes**
1. Click any shape button (Triangle, Rectangle, Hexagon)
2. A shape appears in the center
3. Click and drag it to move

**Option 2: Draw Custom Shape**
1. Click "Draw from Points"
2. Click on canvas to add vertices (minimum 3)
3. Click "Complete Polygon" when done
4. Your custom polygon is created!

### Customize Colors

1. Use the **Fill Color** picker to change interior color
2. Use the **Stroke Color** picker to change border color
3. All new polygons will use these colors

### Save Your Work

1. Click "Save" to store in browser
2. Click "Export JSON" to download a file
3. Click "Load" to restore saved polygons

## 📖 Understanding the Code

### File Structure

```
src/
├── app.js                    # Main coordinator
├── components/               # UI Web Components
│   ├── AppHeader.js         # Header bar
│   ├── CanvasToolbar.js     # Canvas info
│   ├── PolygonCanvas.js     # Canvas wrapper
│   ├── DrawToolsSection.js  # Drawing tools
│   ├── CustomizeSection.js  # Color pickers
│   ├── FileOperationsSection.js  # File ops
│   ├── ActionsSection.js    # Actions
│   └── StatsSection.js      # Statistics
├── controllers/
│   └── PolygonCanvasController.js  # Canvas logic
├── models/
│   └── Polygon.js           # Polygon model
├── services/
│   ├── StorageService.js    # localStorage
│   └── FileService.js       # File import/export
└── utils/
    └── EventBus.js          # Event system
```

### How It Works

1. **app.js** initializes everything
2. **Components** handle UI and user interactions
3. **Controller** manages canvas and polygons
4. **Services** handle data persistence
5. **EventBus** connects everything together

### Event Flow Example

```
User clicks "Triangle" button
    ↓
DrawToolsSection emits 'action:createTriangle'
    ↓
App receives event
    ↓
App calls controller.createTriangle()
    ↓
Controller creates polygon and emits 'polygon:added'
    ↓
Components receive 'polygon:added' and update UI
```

## 🔧 Making Changes

### Add a New Shape Button

1. **Edit DrawToolsSection.js:**
   ```javascript
   // Add button in render()
   <md-outlined-button id="addPentagon" class="tool-button">
       <md-icon slot="icon">pentagon</md-icon>
       Pentagon
   </md-outlined-button>
   
   // Add click handler in setupEventListeners()
   pentagonBtn?.addEventListener('click', () => 
       eventBus.emit('action:createPentagon')
   );
   ```

2. **Edit app.js:**
   ```javascript
   // Add action handler in setupEventHandlers()
   eventBus.on('action:createPentagon', () => 
       this.canvasController.createPentagon()
   );
   ```

3. **Edit PolygonCanvasController.js:**
   ```javascript
   createPentagon() {
       const vertices = this.generateCenteredPolygonVertices(5, 70);
       this.addPolygon(new Polygon(vertices, this.defaultColor, this.defaultStrokeColor));
   }
   ```

Done! Your new pentagon button works.

### Add a New Component

1. **Create component file:**
   ```javascript
   // src/components/MyComponent.js
   import { eventBus } from '../utils/EventBus.js';
   
   export class MyComponent extends HTMLElement {
       constructor() {
           super();
           this.attachShadow({ mode: 'open' });
       }
       
       connectedCallback() {
           this.render();
           this.setupEventListeners();
       }
       
       setupEventListeners() {
           // Listen to events
           eventBus.on('some:event', (data) => {
               console.log('Event received:', data);
           });
       }
       
       render() {
           this.shadowRoot.innerHTML = `
               <style>
                   :host { display: block; }
               </style>
               <div>My Component</div>
           `;
       }
   }
   
   customElements.define('my-component', MyComponent);
   ```

2. **Import in app.js:**
   ```javascript
   import './components/MyComponent.js';
   ```

3. **Add to index.html:**
   ```html
   <my-component></my-component>
   ```

## 📚 Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for complete architecture details
- Check [COMPONENT_INDEX.md](COMPONENT_INDEX.md) for API reference
- Browse [FEATURES.md](FEATURES.md) for feature documentation

## 💡 Tips

1. **Components are small** - Each file is focused and easy to understand
2. **Use EventBus** - Never directly call other components
3. **Keep it modular** - New features go in new files
4. **Shadow DOM** - Each component has isolated styles
5. **No frameworks** - Pure Web Components standard

## 🐛 Debugging

**See what events are happening:**
```javascript
// Add to app.js
eventBus.on('*', (event, data) => {
    console.log('Event:', event, data);
});
```

**Inspect a component:**
```javascript
// In browser console
document.querySelector('draw-tools-section').shadowRoot
```

**Check controller state:**
```javascript
// The controller is attached to the App instance
// You can access it via browser console
```

## 🎯 Common Tasks

### Change Default Colors
Edit `PolygonCanvasController.js`:
```javascript
this.defaultColor = '#YOUR_COLOR';
this.defaultStrokeColor = '#YOUR_COLOR';
```

### Add More Stats
Edit `StatsSection.js` to display additional statistics.

### Change Canvas Size
Edit `app.js` in the `resizeCanvas()` method.

### Add Keyboard Shortcuts
Add event listener in `app.js`:
```javascript
window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete') {
        eventBus.emit('action:deleteSelected');
    }
});
```

## ✅ You're Ready!

You now understand the modular architecture and can start customizing the app. Happy coding! 🎉
