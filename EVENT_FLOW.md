# Event Flow Diagrams

Visual representation of how events flow through the Polygon Studio application.

## 🔄 Event System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         EventBus                            │
│                  (Central Communication Hub)                │
│                                                             │
│  • Decouples all components                                │
│  • Provides pub/sub pattern                                │
│  • Enables loose coupling                                  │
└─────────────────────────────────────────────────────────────┘
         ▲                    │                    ▲
         │                    │                    │
    emit │               emit │              on    │
         │                    ▼                    │
┌────────┴─────────┐   ┌───────────┐   ┌─────────┴────────┐
│   Components     │   │    App    │   │   Components     │
│  (Publishers)    │   │(Mediator) │   │  (Subscribers)   │
└──────────────────┘   └───────────┘   └──────────────────┘
```

## 📊 Common Event Flows

### 1. Creating a Polygon

```
┌─────────────────┐
│ User clicks     │
│ "Triangle"      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ DrawToolsSection                │
│ • Handles click event           │
│ • Emits: 'action:createTriangle'│
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ EventBus                        │
│ • Receives event                │
│ • Notifies all listeners        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App                             │
│ • Receives event                │
│ • Calls controller method       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ PolygonCanvasController         │
│ • Creates Polygon instance      │
│ • Adds to polygons array        │
│ • Draws on canvas               │
│ • Emits: 'polygon:added'        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ EventBus                        │
│ • Broadcasts to all subscribers │
└────────┬────────────────────────┘
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│CanvasToolbar│   │StatsSection │   │   Canvas    │
│• Updates    │   │• Updates    │   │• Redraws    │
│  count      │   │  stats      │   │             │
└─────────────┘   └─────────────┘   └─────────────┘
```

### 2. Drawing Mode Flow

```
User clicks "Draw from Points"
         │
         ▼
┌─────────────────────────────────┐
│ DrawToolsSection                │
│ emit('action:startDrawing')     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App → Controller                │
│ controller.startDrawingMode()   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ PolygonCanvasController         │
│ • Set drawingMode = true        │
│ • Clear drawingPoints           │
│ • emit('drawing:started')       │
└────────┬────────────────────────┘
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│DrawTools    │   │CanvasToolbar│   │   Canvas    │
│• Disable    │   │• Show       │   │• Enable     │
│  start btn  │   │  drawing    │   │  crosshair  │
│• Enable     │   │  status     │   │             │
│  cancel btn │   │             │   │             │
└─────────────┘   └─────────────┘   └─────────────┘

User clicks on canvas
         │
         ▼
┌─────────────────────────────────┐
│ PolygonCanvasController         │
│ • Add point to drawingPoints    │
│ • emit('drawing:pointAdded')    │
└────────┬────────────────────────┘
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│DrawTools    │   │CanvasToolbar│   │   Canvas    │
│• Enable     │   │• Update     │   │• Draw       │
│  complete   │   │  point      │   │  preview    │
│  (if >= 3)  │   │  count      │   │             │
└─────────────┘   └─────────────┘   └─────────────┘
```

### 3. File Operations Flow

```
User clicks "Export JSON"
         │
         ▼
┌─────────────────────────────────┐
│ FileOperationsSection           │
│ emit('action:export')           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App                             │
│ • Get data from controller      │
│ • Call FileService.exportToJSON │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ FileService                     │
│ • Create JSON blob              │
│ • Trigger download              │
│ • Return success result         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App                             │
│ • Show notification             │
│ • Log result                    │
└─────────────────────────────────┘
```

### 4. Stats Update Flow

```
Any polygon change event
         │
         ▼
┌─────────────────────────────────┐
│ EventBus                        │
│ • polygon:added                 │
│ • polygon:deleted               │
│ • polygons:cleared              │
│ • drawing:completed             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ StatsSection                    │
│ • Receives event                │
│ • emit('request:stats')         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ EventBus                        │
│ • Routes request with callback  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App                             │
│ • Gets stats from controller    │
│ • Calls callback with data      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ StatsSection                    │
│ • Receives stats data           │
│ • Updates display               │
└─────────────────────────────────┘
```

## 🎯 Event Categories

### Action Events
**Source:** UI Components  
**Destination:** App → Controller  
**Purpose:** User-initiated actions

Examples:
- `action:createTriangle`
- `action:save`
- `action:deleteSelected`

### State Change Events
**Source:** Controller  
**Destination:** All listening components  
**Purpose:** Notify of state changes

Examples:
- `polygon:added`
- `drawing:started`
- `polygons:cleared`

### Color Events
**Source:** CustomizeSection  
**Destination:** App → Controller  
**Purpose:** Update default colors

Examples:
- `color:fillChanged`
- `color:strokeChanged`

### Request Events
**Source:** Components needing data  
**Destination:** App (which queries Controller)  
**Purpose:** Get current state

Examples:
- `request:polygonCount`
- `request:stats`

## 📋 Event Reference

| Event | Emitter | Handler | Payload |
|-------|---------|---------|---------|
| `action:startDrawing` | DrawToolsSection | App → Controller | - |
| `action:completePolygon` | DrawToolsSection | App → Controller | - |
| `action:createTriangle` | DrawToolsSection | App → Controller | - |
| `action:save` | FileOperationsSection | App | - |
| `action:import` | FileOperationsSection | App | `File` |
| `polygon:added` | Controller | All components | `Polygon` |
| `polygon:selected` | Controller | CanvasToolbar | `Polygon` |
| `drawing:started` | Controller | DrawToolsSection, CanvasToolbar | - |
| `drawing:pointAdded` | Controller | DrawToolsSection, CanvasToolbar | `{count}` |
| `color:fillChanged` | CustomizeSection | App → Controller | `string` |
| `request:stats` | StatsSection | App | `callback` |

## 💡 Benefits of This Architecture

### 1. Loose Coupling
Components don't know about each other, only about events.

### 2. Easy Testing
Each component can be tested independently by mocking the EventBus.

### 3. Easy Debugging
All events flow through one place - add logging to EventBus.

### 4. Scalability
Add new components without modifying existing ones.

### 5. Maintainability
Clear event contracts make the system predictable.

## 🔍 Debugging Events

### Log All Events
Add to `EventBus.js`:
```javascript
emit(event, data) {
    console.log(`[EventBus] ${event}`, data);
    // ...rest of emit code
}
```

### Log Specific Events
In any component:
```javascript
eventBus.on('polygon:added', (polygon) => {
    console.log('Polygon added:', polygon);
});
```

### Track Event Flow
Use browser DevTools:
1. Open Console
2. Add event listener
3. Perform action
4. Watch event chain

## 🎓 Learning Path

1. **Start with a simple event**
   - Trace `action:createTriangle` from click to rendering
   
2. **Follow a complex flow**
   - Understand drawing mode (multiple events)
   
3. **Add your own event**
   - Create new button → new event → new action
   
4. **Modify existing flow**
   - Change what happens when polygon is added

## 🚀 Next Steps

- Read `EventBus.js` implementation (only ~45 lines!)
- Add `console.log` to trace events
- Create your own custom event
- Build a new component using events
