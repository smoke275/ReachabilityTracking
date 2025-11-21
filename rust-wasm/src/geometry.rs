//! Geometry utilities for collision detection and spatial queries

use crate::types::{Point, Polygon};
use std::f64::consts::PI;

/// Wrap angle to [-π, π]
pub fn wrap_to_pi(mut angle: f64) -> f64 {
    while angle > PI {
        angle -= 2.0 * PI;
    }
    while angle < -PI {
        angle += 2.0 * PI;
    }
    angle
}

/// Check if a point is inside a polygon using ray casting algorithm
pub fn point_in_polygon(p: &Point, poly: &Polygon) -> bool {
    let vertices = &poly.vertices;
    if vertices.len() < 3 {
        return false;
    }
    
    let mut inside = false;
    let mut j = vertices.len() - 1;
    
    for i in 0..vertices.len() {
        let xi = vertices[i].x;
        let yi = vertices[i].y;
        let xj = vertices[j].x;
        let yj = vertices[j].y;
        
        let intersect = ((yi > p.y) != (yj > p.y))
            && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        
        if intersect {
            inside = !inside;
        }
        
        j = i;
    }
    
    inside
}

/// Check if two line segments intersect
pub fn segments_intersect(p1: &Point, p2: &Point, p3: &Point, p4: &Point) -> bool {
    fn ccw(a: &Point, b: &Point, c: &Point) -> bool {
        (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
    }
    
    ccw(p1, p3, p4) != ccw(p2, p3, p4) && ccw(p1, p2, p3) != ccw(p1, p2, p4)
}

/// Check if a line segment intersects with a polygon
pub fn segment_intersects_polygon(start: &Point, end: &Point, poly: &Polygon) -> bool {
    let vertices = &poly.vertices;
    
    if vertices.len() < 3 {
        return false;
    }
    
    // Check if either endpoint is inside the polygon
    if point_in_polygon(start, poly) || point_in_polygon(end, poly) {
        return true;
    }
    
    // Check if segment intersects any edge of the polygon
    for i in 0..vertices.len() {
        let v1 = &vertices[i];
        let v2 = &vertices[(i + 1) % vertices.len()];
        
        if segments_intersect(start, end, v1, v2) {
            return true;
        }
    }
    
    false
}

/// Calculate distance from point to line segment
pub fn point_to_segment_distance(p: &Point, v1: &Point, v2: &Point) -> f64 {
    let dx = v2.x - v1.x;
    let dy = v2.y - v1.y;
    let length_sq = dx * dx + dy * dy;
    
    if length_sq == 0.0 {
        return p.distance_to(v1);
    }
    
    let mut t = ((p.x - v1.x) * dx + (p.y - v1.y) * dy) / length_sq;
    t = t.max(0.0).min(1.0);
    
    let proj_x = v1.x + t * dx;
    let proj_y = v1.y + t * dy;
    let proj = Point::new(proj_x, proj_y);
    
    p.distance_to(&proj)
}

/// Check if a circular robot collides with any obstacles
pub fn robot_collides_with_obstacles(
    x: f64,
    y: f64,
    radius: f64,
    obstacles: &[Polygon],
) -> bool {
    let robot_pos = Point::new(x, y);
    
    for obstacle in obstacles {
        // Check if robot center is inside obstacle
        if point_in_polygon(&robot_pos, obstacle) {
            return true;
        }
        
        // Check if any edge of the obstacle is within robot radius
        let vertices = &obstacle.vertices;
        for i in 0..vertices.len() {
            let v1 = &vertices[i];
            let v2 = &vertices[(i + 1) % vertices.len()];
            
            let dist = point_to_segment_distance(&robot_pos, v1, v2);
            if dist < radius {
                return true;
            }
        }
    }
    
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrap_to_pi() {
        assert!((wrap_to_pi(0.0) - 0.0).abs() < 1e-10);
        assert!((wrap_to_pi(PI) - PI).abs() < 1e-10);
        assert!((wrap_to_pi(-PI) - (-PI)).abs() < 1e-10);
        // These test values are close to -PI and PI, within floating point tolerance
        let wrapped_3pi = wrap_to_pi(3.0 * PI);
        assert!(wrapped_3pi.abs() - PI.abs() < 1e-10, "Expected ~-PI or ~PI, got {}", wrapped_3pi);
        let wrapped_neg3pi = wrap_to_pi(-3.0 * PI);
        assert!(wrapped_neg3pi.abs() - PI.abs() < 1e-10, "Expected ~-PI or ~PI, got {}", wrapped_neg3pi);
    }

    #[test]
    fn test_point_in_polygon() {
        let square = Polygon::new(vec![
            Point::new(0.0, 0.0),
            Point::new(10.0, 0.0),
            Point::new(10.0, 10.0),
            Point::new(0.0, 10.0),
        ]);
        
        assert!(point_in_polygon(&Point::new(5.0, 5.0), &square));
        assert!(!point_in_polygon(&Point::new(15.0, 5.0), &square));
        assert!(!point_in_polygon(&Point::new(-5.0, 5.0), &square));
    }

    #[test]
    fn test_segments_intersect() {
        let p1 = Point::new(0.0, 0.0);
        let p2 = Point::new(10.0, 10.0);
        let p3 = Point::new(0.0, 10.0);
        let p4 = Point::new(10.0, 0.0);
        
        assert!(segments_intersect(&p1, &p2, &p3, &p4));
        
        let p5 = Point::new(20.0, 20.0);
        let p6 = Point::new(30.0, 30.0);
        
        assert!(!segments_intersect(&p1, &p2, &p5, &p6));
    }
}
