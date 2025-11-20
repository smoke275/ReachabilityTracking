# Polygon Visualizer - Features

## 🎨 Drawing Tools

### Point-by-Point Drawing (New!)
- **Draw from Points** - Enter drawing mode to create custom polygons
  - **Left Click** - Add a point at cursor position
  - **Right Click** - Remove the last point added
  - **Complete Polygon** - Finish drawing (requires at least 3 points)
  - **Cancel Drawing** - Exit drawing mode without creating polygon
  - Visual feedback:
    - Points are numbered (1, 2, 3...)
    - First point is green, others are purple
    - Dashed line preview shows polygon closure (when 3+ points)
    - Canvas border highlights during drawing mode

### Preset Shapes
- **Triangle** - Creates an equilateral triangle
- **Rectangle** - Creates a rectangle shape
- **Hexagon** - Creates a regular hexagon
- **Random** - Generates a random polygon with 3-7 sides

### Customization
- **Fill Color** - Choose the fill color for new polygons
- **Stroke Color** - Choose the outline color for new polygons

## 💾 File Operations

### Save & Load
- **Save** - Saves all polygons to browser's local storage
  - Data persists even after closing the browser
  - Click "Save" after making changes you want to keep

- **Load** - Loads previously saved polygons from local storage
  - Restores your last saved work
  - Warning: This will replace current polygons

- **Export JSON** - Downloads all polygons as a JSON file
  - Creates a timestamped file (e.g., `polygons-1234567890.json`)
  - Can be shared with others or used as a backup

- **Load** (File Input) - Import polygons from a JSON file
  - Click "Load" to select a file from your computer
  - Supports JSON files exported from this app

## 🎯 Actions

### Polygon Management
- **Delete Selected** - Removes the currently selected polygon
  - First select a polygon by clicking on it
  - Then click this button to delete it

- **Clear All** - Removes all polygons from the canvas
  - Shows a confirmation dialog
  - Cannot be undone (unless you saved before)

## 🖱️ Mouse/Touch Interactions

### Point-by-Point Drawing Mode
- **Left Click** - Add point to polygon being drawn
- **Right Click** - Remove last point added
- Points are numbered and connected with lines
- First point shown in green (starting point)
- Dashed preview line shows how polygon will close

### Selection
- Click on any polygon to select it (when not in drawing mode)
- Selected polygons show:
  - Red outline instead of normal stroke color
  - Red dots at each vertex
  - Info in the sidebar

### Dragging
- Click and drag a selected polygon to move it
- Works with both mouse and touch input

### Deselection
- Click on empty canvas space to deselect

## 📊 Info Panel

The sidebar shows real-time information:
- **Polygon count** - Total number of polygons on canvas
- **Selected info** - Details about the currently selected polygon (number of vertices)
- **Drawing info** - When in drawing mode, shows point count and readiness status

## ⌨️ Keyboard Shortcuts

### Mouse Actions
- **Left Click** - Add point (in drawing mode) or select polygon (normal mode)
- **Right Click** - Remove last point (in drawing mode)
- **Click + Drag** - Move selected polygon

### Future Keyboard Shortcuts
None currently implemented, but could be added:
- Suggested: `Delete` key to remove selected polygon
- Suggested: `Ctrl+S` to save
- Suggested: `Ctrl+A` to select all

## 🎨 Material Design 3

The app uses Google's Material Design 3 components:
- Filled buttons for primary actions
- Tonal buttons for secondary actions
- Outlined buttons for tertiary actions
- Material icons throughout
- Modern color scheme with proper contrast

## 📱 Responsive Design

- Desktop: Sidebar on the left, canvas on the right
- Tablet/Mobile: Sidebar stacks on top, full-width canvas below
- Touch-friendly interactions

## 💡 Tips

1. **Point-by-point drawing** - For precise polygon shapes, use "Draw from Points" mode
   - Click carefully to place each point
   - Right-click if you make a mistake to undo the last point
   - You need at least 3 points to complete a polygon
   - Watch the dashed line preview to see how the polygon will close
2. **Experiment with colors** - Try different color combinations for unique designs
3. **Save frequently** - Use the Save button to preserve your work
4. **Export important work** - Download JSON files for important designs
5. **Random shapes** - Click Random multiple times for interesting patterns
6. **Layering** - Polygons can overlap; most recent ones appear on top
7. **Precise placement** - Drag polygons to position them exactly where you want

## 🔧 Technical Details

- Built with vanilla JavaScript (ES6+)
- Uses HTML5 Canvas for rendering
- Vite for fast development and bundling
- Material Web Components for UI
- Local Storage API for persistence
- File API for import/export

## 🚀 Future Enhancements

Potential features to add:
- Edit polygon vertices individually
- Rotate polygons
- Scale/resize polygons
- Snap to grid
- Undo/redo functionality
- Copy/paste polygons
- Keyboard shortcuts
- Export as PNG/SVG image
- Multiple selection
- Grouping polygons
- Layers panel
