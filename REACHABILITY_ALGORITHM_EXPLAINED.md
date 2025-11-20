# Evader Future Reachability Set - Algorithm Explained

## Overview

The **evader's future reachability set** represents all positions the evader can reach within a given time horizon (default: 3 seconds), considering:
- Motion constraints (maximum velocity and turning rate)
- Current position and heading
- Obstacles in the environment

This visualization helps understand where the evader can move, which is crucial for pursuit-evasion planning.

---

## Visual Representation

In the simulation (`simple_sim_minimal.py`):
- **Colored dots** around the evader show reachable positions
- **Color intensity** indicates reachability score:
  - 🔴 **Red/Orange**: Highly reachable (easy to reach efficiently)
  - 🟡 **Yellow**: Moderately reachable
  - 🟢 **Green**: Barely reachable (requires complex maneuvers)
- **Cyan circle**: Maximum reachable distance boundary
- **5,000 grid points** evaluated by default

---

## Algorithm: Grid-Based Forward Propagation

### Step 1: Grid Generation

**Function**: `create_grid_in_circle(center_x, center_y)`

Creates a circular grid of candidate positions:

```
Grid Properties:
├── Center: Evader's current position
├── Radius: v_max × time_horizon (maximum possible reach)
│            Example: 1.0 m/s × 3.0 s = 3.0 m radius
├── Resolution: ~0.15 m (15 cm between points)
└── Total Points: ~5,000 (configurable via target_grid_points)
```

**Optimization**:
- Results are **cached** based on discretized center position
- Avoids recomputing for small movements
- Grid is reused when evader moves < 0.3 m

---

### Step 2: Motion Model (Unicycle Kinematics)

The evader uses a **differential drive (unicycle) model** with 10 precomputed motion primitives:

#### Motion Primitives (v, ω):
```python
1.  (v_max, 0)                    # Straight forward at max speed
2.  (v_max, ω_max)                # Hard left turn
3.  (v_max, -ω_max)               # Hard right turn
4.  (v_max, ω_max × 0.5)          # Moderate left
5.  (v_max, -ω_max × 0.5)         # Moderate right
6.  (v_max × 0.7, ω_max × 0.7)    # Medium speed curved left
7.  (v_max × 0.7, -ω_max × 0.7)   # Medium speed curved right
8.  (v_max × 0.5, ω_max)          # Slow speed tight left
9.  (v_max × 0.5, -ω_max)         # Slow speed tight right
10. (v_max × 0.5, 0)              # Slow forward
```

#### Kinematic Equations:

**Straight Motion** (ω ≈ 0):
```
x_new = x + v × cos(θ) × dt
y_new = y + v × sin(θ) × dt
θ_new = θ
```

**Arc Motion** (ω ≠ 0):
```
radius = v / ω
Δθ = ω × dt
x_new = x + radius × (sin(θ + Δθ) - sin(θ))
y_new = y - radius × (cos(θ + Δθ) - cos(θ))
θ_new = θ + Δθ
```

**Time Step**: dt = 0.25 seconds

---

### Step 3: Forward Search (Dijkstra-like)

**Function**: `compute_reachability_scores(start_state, grid_points)`

Uses a **priority queue** to propagate reachability scores:

#### Algorithm Pseudocode:
```python
# Initialize
scores = {all grid points: 0.0}
scores[start_position] = 1.0
priority_queue = [(1.0, start_x, start_y, start_θ, step=0)]
visited = set()

# Expand states
while priority_queue not empty and expansions < 100,000:
    (current_score, x, y, θ, step) = pop highest score
    
    if step > 25:  # Maximum depth
        continue
    
    # Mark as visited
    visited.add((discretized_position, θ_bin, step))
    
    # Try all 10 motion primitives
    for each motion primitive (v, ω):
        # Compute next state
        (x_new, y_new, θ_new) = apply_motion(x, y, θ, v, ω, dt)
        
        # Check validity
        if not in_collision(x_new, y_new):
            # Compute transition cost
            cost = compute_cost(x, y, θ, x_new, y_new, θ_new, v, ω)
            
            # Update score
            new_score = current_score × exp(-cost)
            
            if new_score > 0.001 and new_score > scores[discretized_position]:
                scores[discretized_position] = new_score
                priority_queue.add((new_score, x_new, y_new, θ_new, step+1))

# Normalize scores to sum to 1.0
scores = {pt: score/total for pt, score in scores.items()}
```

#### Key Parameters:
- **Max steps**: 25 (prevents infinite exploration)
- **Max expansions**: 100,000 (computational budget)
- **Score threshold**: 0.001 (prune low-probability paths)
- **θ bins**: 16 (discretize heading into 16 directions)

---

### Step 4: Transition Cost Function

Penalizes inefficient movements to favor realistic paths:

```python
cost = control_cost + heading_cost + distance_cost + obstacle_cost
```

#### Components:

1. **Control Cost** (energy):
   ```
   control_cost = 0.05 × (v² + ω²) × dt
   ```
   - Penalizes high speeds and sharp turns
   - Encourages smooth motion

2. **Heading Cost** (alignment):
   ```
   heading_cost = 0.3 × |heading_error| / π
   ```
   - Penalizes moving away from target direction
   - Encourages forward progress

3. **Distance Cost** (efficiency):
   ```
   distance_cost = 0.05 × distance_traveled
   ```
   - Prefers shorter paths

4. **Obstacle Cost** (safety):
   ```
   if min_distance_to_obstacle < 0.3m:
       obstacle_cost = 5.0 × (0.3 - min_distance)
   else:
       obstacle_cost = 0.0
   ```
   - Heavy penalty for getting close to obstacles
   - Creates safety margins

#### Score Update:
```python
new_score = current_score × exp(-total_cost)
```
- Exponential decay ensures scores remain in [0, 1]
- Lower cost → Higher score → More reachable

---

### Step 5: Collision Checking

Two methods for fast obstacle detection:

#### Method A: Signed Distance Field (SDF)
```
Build Phase:
├── Create 2D grid covering reachability area
├── Precompute distance to nearest obstacle for each cell
├── Resolution: 0.1 m (10 cm)
└── Built once per evader position

Query Phase:
├── Convert (x, y) to grid coordinates
├── Use bilinear interpolation for smooth values
└── O(1) lookup time
```

**Advantages**: Extremely fast queries (~1 microsecond)

#### Method B: Direct Geometric Queries
```
For each position:
├── Check if point inside any obstacle polygon
├── Compute distance to each obstacle edge
└── Cache results for repeated queries
```

**Advantages**: No preprocessing, good for dynamic obstacles

---

### Step 6: Score Normalization

Final step ensures probabilistic interpretation:

```python
total = sum(all scores)
normalized_scores = {point: score/total for point, score in scores.items()}
```

- Scores sum to 1.0
- Can be interpreted as probability distribution
- Maintains relative reachability rankings

---

## Performance Optimizations

### 1. **Caching System**
```
Grid Cache:         Stores generated grids for nearby positions
Obstacle Cache:     Stores computed obstacle costs
Filtered Obstacles: Stores obstacles near current position
Spatial Hash:       Fast grid point lookups
```

### 2. **Lookup Tables**
- Precomputed **sin/cos** tables (360 bins)
- Avoids expensive trigonometric calculations
- ~10x speedup for angle computations

### 3. **C++ Implementation**
Located in `reachability_cpp/`:

```
Performance Comparison:
├── Python: ~200 ms for 5,000 points
├── C++:    ~10-20 ms for 5,000 points
└── Speedup: 10-20x faster
```

**Build C++ version**:
```bash
cd reachability_cpp
pip install .
```

### 4. **Adaptive Grid Resolution**
```python
# Sparse grid for real-time (fast)
planner = GridBasedReachability(..., target_grid_points=1000)

# Dense grid for analysis (accurate)
planner = GridBasedReachability(..., target_grid_points=10000)
```

---

## Code Usage

### Basic Usage:
```python
from reachability_planner import GridBasedReachability
from shapely.geometry import Polygon

# Define obstacles
obstacles = [Polygon([(3, 2), (6, 2), (6, 6), (3, 6)])]

# Create planner
planner = GridBasedReachability(
    v_max=1.0,              # 1 m/s max velocity
    omega_max=1.0,          # 1 rad/s max turn rate
    time_horizon=3.0,       # 3 second lookahead
    obstacles=obstacles,
    target_grid_points=5000,
    verbose=False
)

# Compute reachability
start_state = (x, y, theta)
scores, grid_points = planner.compute_reachability(start_state)

# Get highly reachable points
reachable = [(pt, score) for pt, score in scores.items() if score > 0.001]
```

### In Simulation:
```python
# Auto-recompute when evader moves
if state_changed:
    if use_cpp:
        # Fast C++ computation
        grid = planner.create_grid_in_circle(x, y)
        scores = cpp_computer.compute_reachability_scores(x, y, theta, grid)
    else:
        # Python computation
        scores, grid = planner.compute_reachability((x, y, theta))
```

---

## Visualization Features

### Toggle Options (Keyboard):
```
R - Toggle reachability visualization (colored dots)
C - Toggle C++/Python computation mode
SPACE - Force recompute reachability
```

### What You See:
1. **Reachability Dots**: Color-coded by score
2. **Max Reach Circle**: Cyan boundary showing theoretical maximum
3. **Computation Time**: Displayed in info panel (top-left)
4. **Reachable Points Count**: Number of points with score > 0.0001

---

## Real-World Applications

### 1. **Pursuit-Evasion Games**
- Evader uses reachability to find escape routes
- Pursuer predicts evader's future positions
- Enables strategic planning

### 2. **Robot Path Planning**
- Visualize feasible motion envelope
- Account for kinematic constraints
- Plan obstacle-free trajectories

### 3. **Safety Verification**
- Verify robot stays within safe regions
- Check if goal is reachable
- Validate motion plans

### 4. **Human-Robot Interaction**
- Show robot's intended motion to humans
- Improve transparency and trust
- Enable collaborative planning

---

## Parameters Reference

### Motion Parameters:
```python
v_max = 1.0        # Maximum linear velocity (m/s)
omega_max = 1.0    # Maximum angular velocity (rad/s)
time_horizon = 3.0 # Planning horizon (seconds)
```

### Grid Parameters:
```python
grid_resolution = 0.15      # Grid spacing (meters)
target_grid_points = 5000   # Target number of points
```

### Search Parameters:
```python
max_steps = 25          # Maximum search depth
max_expansions = 100000 # Computational budget
theta_bins = 16         # Heading discretization
dt = 0.25              # Time step (seconds)
```

### Cost Weights:
```python
control_weight = 0.05   # Energy cost
heading_weight = 0.3    # Heading alignment
distance_weight = 0.05  # Path length
obstacle_weight = 5.0   # Safety margin
```

---

## Tips for Tuning

### Faster Computation:
- ↓ `target_grid_points` (e.g., 1000-2000)
- ↓ `time_horizon` (e.g., 2.0 seconds)
- Use C++ implementation
- Increase `grid_resolution` (coarser grid)

### Better Accuracy:
- ↑ `target_grid_points` (e.g., 10000)
- ↓ `grid_resolution` (finer grid)
- ↑ `max_steps` and `max_expansions`
- ↑ `theta_bins` (more heading directions)

### Trade-offs:
```
Grid Points:  1K → 50ms    | Coarse but fast
              5K → 200ms   | Balanced (default)
              10K → 500ms  | Dense but slow
              
C++ Speedup:  10-20x faster than Python
```

---

## Files Reference

### Core Implementation:
```
reachability_planner.py          # Python implementation (main)
reachability_cpp/                # C++ accelerated version
├── reachability_core.cpp        # Core algorithm
├── reachability_core.hpp        # Header file
├── bindings.cpp                 # Python bindings
└── setup.py                     # Build script
```

### Simulation:
```
simple_sim_minimal.py            # Main simulation (this file)
multitrack/models/agents/        # Agent motion models
└── visitor_agent.py             # Unicycle kinematics
```

### Documentation:
```
README_USAGE.md                  # Usage guide
REACHABILITY_ALGORITHM_EXPLAINED.md  # This file
BUILD_INSTRUCTIONS.md            # C++ build instructions
```

---

## Algorithm Complexity

### Time Complexity:
```
O(N × M × P)
where:
  N = number of grid points (~5,000)
  M = motion primitives (10)
  P = search depth (~25 steps)
  
Worst case: ~1,250,000 state expansions
Typical: ~10,000-100,000 expansions (early termination)
```

### Space Complexity:
```
O(N + V)
where:
  N = grid points storage
  V = visited states (position × heading × step)
  
Typical: ~50-100 KB per computation
```

---

## Debugging Tips

### Enable Verbose Output:
```python
planner = GridBasedReachability(..., verbose=True)
```

### Check Cache Statistics:
```python
stats = planner.get_cache_stats()
print(f"Grid cache: {stats['grid_cache_size']} entries")
print(f"Obstacle cache: {stats['obstacle_cache_size']} entries")
```

### Visualize Grid:
```python
# In simulation, press 'R' to toggle reachability display
# Red dots = highly reachable
# Green dots = barely reachable
```

### Performance Profiling:
```python
import time
t_start = time.time()
scores, grid = planner.compute_reachability(start_state)
t_end = time.time()
print(f"Computation time: {(t_end - t_start)*1000:.1f} ms")
```

---

## Future Improvements

### Potential Enhancements:
1. **Dynamic obstacles**: Update obstacles in real-time
2. **Multiple agents**: Compute joint reachability sets
3. **GPU acceleration**: Parallel grid evaluation
4. **Learned costs**: Machine learning for cost function
5. **Probabilistic obstacles**: Handle uncertain environments

---

## References

### Related Work:
- Forward Reachability Analysis for Autonomous Systems
- Hamilton-Jacobi Reachability (continuous approach)
- Rapidly-exploring Random Trees (RRT) for motion planning
- Model Predictive Control (MPC) with reachability constraints

### Papers:
- "A Review of Motion Planning Techniques for Automated Vehicles" (2016)
- "Reachability-based Trajectory Design with Neural Implicit Representations" (2022)

---

## Contact & Support

For questions or issues:
1. Check `README_USAGE.md` for basic usage
2. Review `BUILD_INSTRUCTIONS.md` for C++ compilation
3. Examine code comments in `reachability_planner.py`
4. Run with `verbose=True` for detailed output

---

**Last Updated**: November 17, 2025  
**Version**: 1.0  
**License**: See project LICENSE file
