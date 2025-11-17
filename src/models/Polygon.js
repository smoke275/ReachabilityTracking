/**
 * Polygon model class
 * Represents a single polygon with vertices, colors, and interaction state
 */
export class Polygon {
    constructor(vertices, color = '#6750A4', strokeColor = '#21005D') {
        this.vertices = vertices; // Array of {x, y} points
        this.color = color;
        this.strokeColor = strokeColor;
        this.fillColor = this.hexToRgba(color, 0.3);
        this.selected = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    draw(ctx) {
        if (this.vertices.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        ctx.closePath();

        // Fill
        ctx.fillStyle = this.fillColor;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = this.selected ? '#B3261E' : this.strokeColor;
        ctx.lineWidth = this.selected ? 3 : 2;
        ctx.stroke();

        // Draw vertices if selected
        if (this.selected) {
            this.vertices.forEach(vertex => {
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#B3261E';
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }

    containsPoint(x, y) {
        // Ray casting algorithm for point in polygon
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x;
            const yi = this.vertices[i].y;
            const xj = this.vertices[j].x;
            const yj = this.vertices[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    translate(dx, dy) {
        this.vertices = this.vertices.map(v => ({
            x: v.x + dx,
            y: v.y + dy
        }));
    }

    getBounds() {
        const xs = this.vertices.map(v => v.x);
        const ys = this.vertices.map(v => v.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }

    toJSON() {
        return {
            vertices: this.vertices,
            color: this.color,
            strokeColor: this.strokeColor
        };
    }

    static fromJSON(data) {
        return new Polygon(data.vertices, data.color, data.strokeColor);
    }
}
