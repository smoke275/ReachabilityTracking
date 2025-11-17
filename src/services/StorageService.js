/**
 * StorageService
 * Handles localStorage operations for polygon data
 */
export class StorageService {
    constructor(storageKey = 'polygonData') {
        this.storageKey = storageKey;
    }

    save(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return { success: true };
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return { success: false, error: error.message };
        }
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) {
                return { success: false, error: 'No saved data found' };
            }
            return { success: true, data: JSON.parse(data) };
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return { success: false, error: error.message };
        }
    }

    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return { success: true };
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return { success: false, error: error.message };
        }
    }

    exists() {
        return localStorage.getItem(this.storageKey) !== null;
    }
}
