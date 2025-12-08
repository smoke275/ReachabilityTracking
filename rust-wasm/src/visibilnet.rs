use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

#[derive(Deserialize)]
pub struct JsPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize)]
pub struct OutPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Deserialize)]
pub struct JsPolygon {
    pub vertices: Vec<JsPoint>,
}

#[derive(Deserialize)]
pub struct JsBounds {
    pub minX: f64,
    pub maxX: f64,
    pub minY: f64,
    pub maxY: f64,
}

#[wasm_bindgen]
pub struct VisibilNetWasmService {
    segments: Vec<(f64, f64, f64, f64)>,
}

#[wasm_bindgen]
impl VisibilNetWasmService {
    #[wasm_bindgen(constructor)]
    pub fn new() -> VisibilNetWasmService {
        VisibilNetWasmService {
            segments: Vec::new(),
        }
    }

    pub fn update_environment(&mut self, polygons: JsValue, bounds: JsValue) -> Result<(), JsValue> {
        let polys: Vec<JsPolygon> = serde_wasm_bindgen::from_value(polygons)?;
        let b: JsBounds = serde_wasm_bindgen::from_value(bounds)?;

        self.segments.clear();
        
        // Polygon segments
        for poly in &polys {
            let v = &poly.vertices;
            let len = v.len();
            for i in 0..len {
                let p1 = &v[i];
                let p2 = &v[(i + 1) % len];
                self.segments.push((p1.x, p1.y, p2.x, p2.y));
            }
        }

        // Bounds segments
        self.segments.push((b.minX, b.minY, b.maxX, b.minY));
        self.segments.push((b.maxX, b.minY, b.maxX, b.maxY));
        self.segments.push((b.maxX, b.maxY, b.minX, b.maxY));
        self.segments.push((b.minX, b.maxY, b.minX, b.minY));
        
        Ok(())
    }

    pub fn get_batch_ray_distances_optimized(
        &self, 
        points_flat: &[f64], 
        num_rays: usize
    ) -> Vec<f64> {
        let num_points = points_flat.len() / 2;
        let mut all_distances = Vec::with_capacity(num_points * num_rays);

        // Precompute ray directions to avoid repeated trig calculations
        let mut ray_dirs = Vec::with_capacity(num_rays);
        for r in 0..num_rays {
            let angle = (r as f64 / num_rays as f64) * 2.0 * PI;
            ray_dirs.push((angle.cos(), angle.sin()));
        }

        for i in 0..num_points {
            let px = points_flat[i * 2];
            let py = points_flat[i * 2 + 1];

            for &(dx, dy) in &ray_dirs {
                let mut min_t = f64::INFINITY;
                
                for &(x1, y1, x2, y2) in &self.segments {
                    // Inlined ray-segment intersection for maximum performance
                    // Ray: P + t*R, Segment: Q + u*S
                    // R = (dx, dy), S = (x2-x1, y2-y1), Q = (x1, y1)
                    // t = (Q-P) x S / (R x S)
                    // u = (Q-P) x R / (R x S)
                    
                    let sx = x2 - x1;
                    let sy = y2 - y1;
                    
                    let rx_sy = dx * sy;
                    let ry_sx = dy * sx;
                    let cross_rs = rx_sy - ry_sx;
                    
                    // Parallel check
                    if cross_rs.abs() < 1e-9 { continue; }
                    
                    let qpx = x1 - px;
                    let qpy = y1 - py;
                    
                    let cross_qs = qpx * sy - qpy * sx;
                    let t = cross_qs / cross_rs;
                    
                    // Optimization: check t first
                    if t >= 0.0 && t < min_t {
                        let cross_qr = qpx * dy - qpy * dx;
                        let u = cross_qr / cross_rs;
                        
                        if u >= 0.0 && u <= 1.0 {
                            min_t = t;
                        }
                    }
                }
                
                if min_t == f64::INFINITY {
                    min_t = 0.0;
                }
                all_distances.push(min_t);
            }
        }

        all_distances
    }

    pub fn compute_ray_based_visibility(
        &self, 
        point: JsValue, 
        polygons: JsValue, 
        bounds: JsValue, 
        num_rays: usize
    ) -> Result<JsValue, JsValue> {
        let p: JsPoint = serde_wasm_bindgen::from_value(point)?;
        let polys: Vec<JsPolygon> = serde_wasm_bindgen::from_value(polygons)?;
        let b: JsBounds = serde_wasm_bindgen::from_value(bounds)?;

        let mut segments = Vec::new();
        
        // Polygon segments
        for poly in &polys {
            let v = &poly.vertices;
            let len = v.len();
            for i in 0..len {
                let p1 = &v[i];
                let p2 = &v[(i + 1) % len];
                segments.push((p1.x, p1.y, p2.x, p2.y));
            }
        }

        // Bounds segments
        segments.push((b.minX, b.minY, b.maxX, b.minY));
        segments.push((b.maxX, b.minY, b.maxX, b.maxY));
        segments.push((b.maxX, b.maxY, b.minX, b.maxY));
        segments.push((b.minX, b.maxY, b.minX, b.minY));

        let mut result_points = Vec::with_capacity(num_rays);

        for i in 0..num_rays {
            let angle = (i as f64 / num_rays as f64) * 2.0 * PI;
            let dx = angle.cos();
            let dy = angle.sin();

            let mut min_t = f64::INFINITY;
            
            for &(x1, y1, x2, y2) in &segments {
                if let Some(t) = ray_segment_intersect(p.x, p.y, dx, dy, x1, y1, x2, y2) {
                    if t < min_t {
                        min_t = t;
                    }
                }
            }

            if min_t < f64::INFINITY {
                result_points.push(OutPoint {
                    x: p.x + min_t * dx,
                    y: p.y + min_t * dy,
                });
            } else {
                // Should not happen if bounds are correct, but fallback to point itself
                result_points.push(OutPoint { x: p.x, y: p.y });
            }
        }

        Ok(serde_wasm_bindgen::to_value(&result_points)?)
    }

    pub fn get_ray_distances(
        &self, 
        point: JsValue, 
        polygons: JsValue, 
        bounds: JsValue, 
        num_rays: usize
    ) -> Result<Vec<f64>, JsValue> {
        let p: JsPoint = serde_wasm_bindgen::from_value(point)?;
        let polys: Vec<JsPolygon> = serde_wasm_bindgen::from_value(polygons)?;
        let b: JsBounds = serde_wasm_bindgen::from_value(bounds)?;

        let mut segments = Vec::new();
        
        for poly in &polys {
            let v = &poly.vertices;
            let len = v.len();
            for i in 0..len {
                let p1 = &v[i];
                let p2 = &v[(i + 1) % len];
                segments.push((p1.x, p1.y, p2.x, p2.y));
            }
        }

        segments.push((b.minX, b.minY, b.maxX, b.minY));
        segments.push((b.maxX, b.minY, b.maxX, b.maxY));
        segments.push((b.maxX, b.maxY, b.minX, b.maxY));
        segments.push((b.minX, b.maxY, b.minX, b.minY));

        let mut distances = Vec::with_capacity(num_rays);

        for i in 0..num_rays {
            let angle = (i as f64 / num_rays as f64) * 2.0 * PI;
            let dx = angle.cos();
            let dy = angle.sin();

            let mut min_t = f64::INFINITY;
            
            for &(x1, y1, x2, y2) in &segments {
                if let Some(t) = ray_segment_intersect(p.x, p.y, dx, dy, x1, y1, x2, y2) {
                    if t < min_t {
                        min_t = t;
                    }
                }
            }

            distances.push(if min_t < f64::INFINITY { min_t } else { 0.0 });
        }

        Ok(distances)
    }
}

fn ray_segment_intersect(px: f64, py: f64, dx: f64, dy: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> Option<f64> {
    let rx = dx;
    let ry = dy;
    let sx = x2 - x1;
    let sy = y2 - y1;
    let qpx = x1 - px;
    let qpy = y1 - py;
    
    let cross = |ax: f64, ay: f64, bx: f64, by: f64| ax * by - ay * bx;
    let den = cross(rx, ry, sx, sy);
    
    if den.abs() < 1e-9 { return None; }
    
    let t = cross(qpx, qpy, sx, sy) / den;
    let u = cross(qpx, qpy, rx, ry) / den;
    
    if t >= 0.0 && u >= 0.0 && u <= 1.0 {
        Some(t)
    } else {
        None
    }
}
