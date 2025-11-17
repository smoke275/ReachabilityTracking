# Component Index

Quick reference for all Web Components in the application.

## Components

### AppHeader
**File:** `src/components/AppHeader.js`  
**Tag:** `<app-header>`  
**Purpose:** Application header with logo and tagline  
**Props:** None  
**Events Emitted:** None  
**Events Listened:** None  

---

### CanvasToolbar
**File:** `src/components/CanvasToolbar.js`  
**Tag:** `<canvas-toolbar>`  
**Purpose:** Display canvas statistics and selection info  
**Props:** None  
**Events Emitted:** 
- `request:polygonCount` - Request current polygon count

**Events Listened:**
- `polygon:added` - Update count when polygon added
- `polygon:deleted` - Update count when polygon deleted
- `polygon:selected` - Update selection display
- `polygon:deselected` - Clear selection display
- `drawing:started` - Show drawing mode
- `drawing:pointAdded` - Update point count
- `drawing:pointRemoved` - Update point count
- `drawing:completed` - Exit drawing mode
- `drawing:cancelled` - Exit drawing mode

---

### PolygonCanvas
**File:** `src/components/PolygonCanvas.js`  
**Tag:** `<polygon-canvas>`  
**Purpose:** Canvas wrapper with container styling  
**Props:** None  
**Methods:**
- `getCanvas()` - Returns the canvas element

**Events Emitted:** None  
**Events Listened:** None  

---

### DrawToolsSection
**File:** `src/components/DrawToolsSection.js`  
**Tag:** `<draw-tools-section>`  
**Purpose:** Drawing tools and shape creation  
**Props:** None  

**Events Emitted:**
- `action:startDrawing` - Start point-by-point drawing
- `action:completePolygon` - Complete current polygon
- `action:cancelDrawing` - Cancel current drawing
- `action:createTriangle` - Create triangle
- `action:createRectangle` - Create rectangle
- `action:createHexagon` - Create hexagon
- `action:createRandom` - Create random polygon

**Events Listened:**
- `drawing:started` - Disable start button
- `drawing:pointAdded` - Enable complete if enough points
- `drawing:pointRemoved` - Update button states
- `drawing:completed` - Reset button states
- `drawing:cancelled` - Reset button states

---

### CustomizeSection
**File:** `src/components/CustomizeSection.js`  
**Tag:** `<customize-section>`  
**Purpose:** Color customization controls  
**Props:** None  

**Events Emitted:**
- `color:fillChanged` - Fill color changed
- `color:strokeChanged` - Stroke color changed

**Events Listened:** None  

---

### FileOperationsSection
**File:** `src/components/FileOperationsSection.js`  
**Tag:** `<file-operations-section>`  
**Purpose:** File save, load, and export operations  
**Props:** None  

**Events Emitted:**
- `action:save` - Save to localStorage
- `action:load` - Load from localStorage
- `action:export` - Export to JSON file
- `action:import` - Import from JSON file

**Events Listened:** None  

---

### ActionsSection
**File:** `src/components/ActionsSection.js`  
**Tag:** `<actions-section>`  
**Purpose:** Delete and clear actions  
**Props:** None  

**Events Emitted:**
- `action:deleteSelected` - Delete selected polygon
- `action:clearAll` - Clear all polygons

**Events Listened:** None  

---

### StatsSection
**File:** `src/components/StatsSection.js`  
**Tag:** `<stats-section>`  
**Purpose:** Display polygon statistics  
**Props:** None  

**Events Emitted:**
- `request:stats` - Request current statistics

**Events Listened:**
- `polygon:added` - Update stats
- `polygon:deleted` - Update stats
- `polygons:cleared` - Update stats
- `polygons:imported` - Update stats
- `drawing:completed` - Update stats

---

## Services

### StorageService
**File:** `src/services/StorageService.js`  
**Purpose:** LocalStorage operations  
**Methods:**
- `save(data)` - Save data to localStorage
- `load()` - Load data from localStorage
- `clear()` - Clear stored data
- `exists()` - Check if data exists

---

### FileService
**File:** `src/services/FileService.js`  
**Purpose:** File import/export operations  
**Methods:**
- `exportToJSON(data, filename)` - Export data to JSON file
- `importFromJSON(file)` - Import data from JSON file (returns Promise)
- `validatePolygonData(data)` - Validate polygon data structure

---

## Controllers

### PolygonCanvasController
**File:** `src/controllers/PolygonCanvasController.js`  
**Purpose:** Manage canvas and polygon interactions  
**Methods:**
- Drawing: `startDrawingMode()`, `completePolygon()`, `cancelDrawing()`
- Creation: `createTriangle()`, `createRectangle()`, `createHexagon()`, `createRandomPolygon()`
- Selection: `selectPolygon(polygon)`, `deselectPolygon()`
- Management: `deleteSelected()`, `clearAll()`
- Colors: `setDefaultColor(color)`, `setDefaultStrokeColor(color)`
- Data: `exportData()`, `importData(data)`
- Info: `getPolygonCount()`, `getTotalVertices()`, `getSelectedPolygon()`

---

## Models

### Polygon
**File:** `src/models/Polygon.js`  
**Purpose:** Polygon data model  
**Properties:**
- `vertices` - Array of {x, y} points
- `color` - Fill color (hex)
- `strokeColor` - Stroke color (hex)
- `selected` - Boolean selection state

**Methods:**
- `draw(ctx)` - Draw on canvas
- `containsPoint(x, y)` - Check if point is inside
- `translate(dx, dy)` - Move polygon
- `getBounds()` - Get bounding box
- `toJSON()` - Serialize to JSON
- `static fromJSON(data)` - Deserialize from JSON

---

## Utils

### EventBus
**File:** `src/utils/EventBus.js`  
**Purpose:** Centralized event system  
**Methods:**
- `on(event, callback)` - Subscribe to event (returns unsubscribe function)
- `off(event, callback)` - Unsubscribe from event
- `emit(event, data)` - Emit event
- `clear()` - Clear all listeners
