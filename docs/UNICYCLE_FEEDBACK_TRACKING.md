# Real-Time Tracking: Unicycle Feedback Control

## Quick Reference

### What Changed
Pursuer tracking now uses **continuous unicycle feedback control** (same as evader simulation) instead of fixed-time execution steps.

### Key Behavior
```
┌─ Plan Path ─┐
│             ▼
│     ┌───────────────────────┐
│     │  Follow waypoints     │
│     │  continuously with    │  ← Smooth unicycle motion
│     │  feedback controller  │     at ~60 FPS
│     └───────────────────────┘
│             │
│     (updateInterval seconds)
│             │
└─────────────┘
```

### Configuration

**Single Parameter:**
- `updateInterval` (0.5-10.0s, default: 2.0s)
  - How often to replan
  - Agent continuously follows path until timer expires

**Control Gains:**
- `K_v = 0.3` - Linear velocity gain
- `K_h = 3.0` - Heading error gain (same as evader)

### Benefits

✅ **Smooth Motion**: No start/stop behavior  
✅ **Efficient**: Only replans at specified intervals  
✅ **Natural**: Same controller as evader simulation  
✅ **Simple**: One parameter to configure  

### Example

**Update Interval = 2.0s:**
```
0.0s   Plan new path
0.0s-2.0s  Smoothly follow waypoints with feedback control
2.0s   Plan new path
2.0s-4.0s  Smoothly follow new waypoints
...
```

### Control Law

```javascript
// Linear velocity (slows when not aligned)
v = K_v * distance * max(0, cos(heading_error))

// Angular velocity (turns to face target)
ω = K_h * heading_error
```

This creates smooth, natural unicycle motion towards targets.
