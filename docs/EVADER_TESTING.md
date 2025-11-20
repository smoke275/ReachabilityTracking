# Testing the Evader Simulation Feature

## Quick Test Guide

### Step 1: Setup Environment
1. Open the application in your browser
2. Create some polygons using the drawing tools:
   - Use "Draw" tool to create custom polygons
   - OR use preset shapes (Triangle, Rectangle, Hexagon)
   - Recommended: Create 2-3 polygons to form an interesting environment

### Step 2: Generate Medial Axis
1. Click the **"Environment Analysis"** button in the Toolbox section
2. In the Analysis Window that opens, click **"Generate Structure"**
3. You should see:
   - Red skeleton edges connecting vertices
   - Red dots at skeleton vertices
   - Yellow dots at leaf nodes (degree-1 vertices)

### Step 3: Start Evader Simulation
1. Click the **"Evader Simulation"** button in the Toolbox section
2. The Evader Simulation window will open (pink/magenta theme)
3. Choose your motion model:
   - **Holonomic**: Direct movement (easier to observe)
   - **Unicycle**: Realistic turning behavior (more interesting)
4. Optionally adjust the speed slider (0.5x to 5x)
5. Click **"Start Simulation"**

### Step 4: Observe Behavior
You should see:
- A **pink circular agent** moving on the canvas
- A **white arrow** (unicycle) or **dot** (holonomic) showing direction
- A **dashed pink line** from agent to its target
- A **transparent pink circle** marking the destination
- The agent automatically chooses a new destination when it reaches the current one

### Controls
- **Stop**: Pause the simulation
- **Reset**: Clear and restart
- **Speed slider**: Adjust movement speed in real-time
- **Motion mode dropdown**: Switch between holonomic and unicycle

### Expected Behavior

#### Holonomic Mode
- Agent moves in a straight line toward target
- Can change direction instantly
- Faster to reach destinations
- More "unrealistic" movement

#### Unicycle Mode
- Agent must rotate to face target first
- Smooth curved paths
- More natural-looking movement
- Takes longer to reach destinations

### Troubleshooting

#### "Please generate environment analysis first!" message
- You need to generate the medial axis skeleton first
- Click Environment Analysis → Generate Structure

#### Evader doesn't appear
- Check browser console for errors
- Ensure polygons exist on canvas
- Try refreshing the page

#### Evader moves too fast/slow
- Use the speed slider to adjust
- Range: 0.5x (slow) to 5x (fast)

#### Window is off-screen
- You can drag the window by its header bar
- Refresh page to reset window positions

### Fun Experiments

1. **Create a maze-like environment**
   - Draw multiple rectangular polygons
   - Create narrow corridors
   - Watch the evader navigate

2. **Compare motion models**
   - Start with holonomic, observe path
   - Stop and switch to unicycle
   - Notice the difference in turning behavior

3. **Speed variations**
   - Set speed to 0.5x: See detailed movement
   - Set speed to 5x: Fast-paced action

4. **Complex environments**
   - Create many small polygons
   - Generate skeleton with high reduction level
   - Observe evader choosing between many vertices

## Video Demo Script

If creating a demo video:
1. **Intro**: "Let me show you the new evader simulation feature"
2. **Setup**: Draw 2-3 polygons quickly
3. **Generate**: Click Environment Analysis, generate skeleton
4. **Launch**: Open Evader Simulation window
5. **Start**: Begin with holonomic mode at 1x speed
6. **Observe**: Point out the pink agent, path line, and target marker
7. **Switch**: Stop, change to unicycle mode, restart
8. **Compare**: Highlight the turning behavior difference
9. **Speed**: Show speed adjustment with slider
10. **Conclusion**: "The evader autonomously chooses destinations on the medial axis"

## Performance Notes

- Tested with up to 50 skeleton vertices - smooth performance
- Animation uses requestAnimationFrame for efficiency
- Can run multiple polygons without lag
- Window is draggable and doesn't block canvas interaction
