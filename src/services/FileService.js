/**
 * FileService
 * Handles file import/export operations
 */
export class FileService {
    exportToJSON(data, filename = null) {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `polygons-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return { success: true };
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            return { success: false, error: error.message };
        }
    }

    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve({ success: true, data });
                } catch (error) {
                    reject(new Error('Invalid JSON file: ' + error.message));
                }
            };
            reader.onerror = () => {
                reject(new Error('Error reading file'));
            };
            reader.readAsText(file);
        });
    }

    validatePolygonData(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid data format' };
        }

        if (!Array.isArray(data.polygons)) {
            return { valid: false, error: 'Missing polygons array' };
        }

        for (const polygon of data.polygons) {
            if (!Array.isArray(polygon.vertices) || polygon.vertices.length < 3) {
                return { valid: false, error: 'Invalid polygon vertices' };
            }
        }

        return { valid: true };
    }
}
