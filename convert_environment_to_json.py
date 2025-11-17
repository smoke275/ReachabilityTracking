"""
Convert simulation_environment.py to JSON format for the polygon application.
"""

import json

def rect_to_polygon(x, y, width, height):
    """Convert a rectangle to polygon vertices format."""
    return {
        "vertices": [
            {"x": x, "y": y},
            {"x": x + width, "y": y},
            {"x": x + width, "y": y + height},
            {"x": x, "y": y + height}
        ]
    }

def create_environment_json():
    """Create JSON representation of the simulation environment."""
    
    # Using scale of 1 (original 1400x1000 dimensions)
    scale_x = 1.0
    scale_y = 1.0
    
    polygons = []
    
    # Outer walls - Dark Gray
    outer_walls = [
        (50, 50, 1300, 10),      # Top wall
        (50, 50, 10, 900),       # left wall
        (1340, 50, 10, 900),     # Right wall
        (50, 940, 1300, 10)      # Bottom wall
    ]
    
    for x, y, w, h in outer_walls:
        poly = rect_to_polygon(int(x * scale_x), int(y * scale_y), 
                              int(w * scale_x), int(h * scale_y))
        poly["fillColor"] = "#787878"      # Dark gray
        poly["strokeColor"] = "#4A4A4A"
        polygons.append(poly)
    
    # Inner walls - Gray
    inner_walls = [
        # Upper left room divider - SPLIT for door
        (50, 300, 150, 10),
        (270, 300, 180, 10),
        
        # Upper right room divider - SPLIT for door
        (550, 300, 100, 10),
        (720, 300, 230, 10),
        
        # Lower middle room divider - SPLIT for doors
        (300, 500, 120, 10),
        (490, 500, 160, 10),
        (720, 500, 80, 10),
        
        # Upper room divider - SPLIT for door
        (450, 50, 10, 100),
        (450, 220, 10, 80),
        
        # Upper right room divider - SPLIT for door
        (700, 50, 10, 100),
        (700, 220, 10, 80),
        
        # Middle left room divider - SPLIT for door
        (300, 300, 10, 80),
        (300, 450, 10, 50),
        
        # Lower right room divider - SPLIT for door
        (550, 500, 10, 100),
        (550, 670, 10, 70),
        
        # Main vertical divider - upper section - SPLIT for doors
        (950, 50, 10, 100),
        (950, 220, 10, 180),
        (950, 470, 10, 130),
        
        # Main vertical divider - lower section - SPLIT for door
        (950, 600, 10, 200),
        (950, 870, 10, 70),
        
        # Upper divider in new wing - SPLIT for door
        (950, 300, 100, 10),
        (1120, 300, 230, 10),
        
        # Middle divider in new wing - SPLIT for door
        (950, 500, 100, 10),
        (1120, 500, 230, 10),
        
        # Lower divider in new wing - SPLIT for door
        (950, 700, 100, 10),
        (1120, 700, 230, 10),
        
        # Upper vertical divider in new wing - SPLIT for door
        (1150, 300, 10, 100),
        (1150, 470, 10, 30),
        
        # Lower vertical divider in new wing - SPLIT for door
        (1150, 500, 10, 100),
        (1150, 670, 10, 30),
    ]
    
    for x, y, w, h in inner_walls:
        poly = rect_to_polygon(int(x * scale_x), int(y * scale_y), 
                              int(w * scale_x), int(h * scale_y))
        poly["fillColor"] = "#909090"      # Gray
        poly["strokeColor"] = "#5A5A5A"
        polygons.append(poly)
    
    # Doors - Tan/Brown
    doors = [
        (300, 380, 10, 70),      # Door to living room
        (550, 600, 10, 70),      # Door to bathroom
        (200, 300, 70, 10),      # Door in upper left
        (650, 300, 70, 10),      # Door in upper right
        (420, 500, 70, 10),      # Door in lower middle
        (650, 500, 70, 10),      # Door connecting rooms
        (450, 150, 10, 70),      # Door in upper vertical
        (700, 150, 10, 70),      # Door in upper right vertical
        (950, 150, 10, 70),      # Door to upper new wing
        (950, 400, 10, 70),      # Door to middle new wing
        (950, 800, 10, 70),      # Door to lower new wing
        (1050, 300, 70, 10),     # Door in upper new wing
        (1050, 500, 70, 10),     # Door in middle new wing
        (1050, 700, 70, 10),     # Door in lower new wing
        (1150, 400, 10, 70),     # Door in upper vertical new wing
        (1150, 600, 10, 70),     # Door in lower vertical new wing
    ]
    
    for x, y, w, h in doors:
        poly = rect_to_polygon(int(x * scale_x), int(y * scale_y), 
                              int(w * scale_x), int(h * scale_y))
        poly["fillColor"] = "#D2B48C"      # Tan
        poly["strokeColor"] = "#8B7355"
        polygons.append(poly)
    
    # Windows - Light Blue
    windows = [
        (250, 50, 80, 10),       # Top wall window
        (750, 50, 80, 10),       # Top wall window
        (50, 200, 10, 80),       # Left wall window
        (50, 600, 10, 80),       # Left wall window
        (1100, 50, 80, 10),      # Top wall window in new wing
        (1340, 200, 10, 80),     # Right wall window
        (1340, 500, 10, 80),     # Right wall window
        (1340, 800, 10, 80),     # Right wall window
        (300, 940, 80, 10),      # Bottom wall window
        (800, 940, 80, 10),      # Bottom wall window
        (1200, 940, 80, 10),     # Bottom wall window
    ]
    
    for x, y, w, h in windows:
        poly = rect_to_polygon(int(x * scale_x), int(y * scale_y), 
                              int(w * scale_x), int(h * scale_y))
        poly["fillColor"] = "#ADD8E6"      # Light blue
        poly["strokeColor"] = "#4682B4"
        polygons.append(poly)
    
    # Create the final JSON structure
    environment_data = {
        "version": "1.0",
        "polygons": polygons,
        "camera": {
            "x": 0,
            "y": 0,
            "zoom": 0.5
        },
        "metadata": {
            "name": "Simulation Environment",
            "description": "Floor plan with rooms, doors, and windows",
            "dimensions": {
                "width": 1400,
                "height": 1000
            },
            "rooms": [
                "Bedroom", "Kitchen", "Living Room", "Study", "Bathroom",
                "Dining Room", "Master Bedroom", "Office", "Game Room",
                "Garage", "Library", "Laundry", "Storage"
            ]
        }
    }
    
    return environment_data

if __name__ == "__main__":
    # Generate the JSON data
    data = create_environment_json()
    
    # Save to file
    output_file = "simulation_environment.json"
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Successfully converted environment to {output_file}")
    print(f"  - Total polygons: {len(data['polygons'])}")
    print(f"  - Dimensions: {data['metadata']['dimensions']['width']}x{data['metadata']['dimensions']['height']}")
    print(f"\nYou can now load this file using the 'Import JSON' button in your application!")
