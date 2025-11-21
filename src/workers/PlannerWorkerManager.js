/**
 * PlannerWorkerManager
 * Manages planner worker with automatic fallback from WASM to JavaScript
 * 
 * Tries to use WASM worker first for better performance (20-45x faster)
 * Falls back to JavaScript worker if WASM fails to load or encounters errors
 */

export class PlannerWorkerManager {
    constructor() {
        this.worker = null;
        this.usingWASM = false;
        this.wasmAttempted = false;
        this.messageHandlers = new Map();
        this.pendingMessages = [];
        this.initialized = false;
    }

    /**
     * Start the worker (tries WASM first, falls back to JS)
     */
    async start() {
        if (this.worker) {
            return { success: true, usingWASM: this.usingWASM };
        }

        // Try WASM worker first if not already attempted and failed
        if (!this.wasmAttempted) {
            const wasmResult = await this._tryStartWASM();
            if (wasmResult.success) {
                this.usingWASM = true;
                console.log('✅ Using WASM worker for high-performance planning');
                return wasmResult;
            }
            
            console.warn('⚠️ WASM worker failed, falling back to JavaScript worker');
        }

        // Fall back to JavaScript worker
        return this._startJavaScript();
    }

    /**
     * Try to start WASM worker
     */
    async _tryStartWASM() {
        try {
            this.worker = new Worker(
                new URL('../workers/plannerWASMWorker.js', import.meta.url), 
                { type: 'module' }
            );
            
            this._setupWorkerHandlers(true);
            
            // Wait for ready signal with timeout
            const ready = await this._waitForReady(2000);
            
            if (ready) {
                this.wasmAttempted = true;
                return { success: true, usingWASM: true };
            } else {
                throw new Error('WASM worker failed to initialize');
            }
        } catch (err) {
            console.error('Failed to start WASM worker:', err);
            this._cleanup();
            this.wasmAttempted = true;
            return { success: false, error: err };
        }
    }

    /**
     * Start JavaScript worker (fallback)
     */
    _startJavaScript() {
        try {
            this.worker = new Worker(
                new URL('../workers/plannerWorker.js', import.meta.url), 
                { type: 'module' }
            );
            
            this._setupWorkerHandlers(false);
            
            console.log('✅ Using JavaScript worker');
            return { success: true, usingWASM: false };
        } catch (err) {
            console.error('Failed to start JavaScript worker:', err);
            return { success: false, error: err };
        }
    }

    /**
     * Setup worker message handlers
     */
    _setupWorkerHandlers(isWASM) {
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data || {};
            
            // Handle WASM errors by falling back
            if (isWASM && type === 'error' && payload?.wasmError && !this.initialized) {
                console.warn('WASM worker error during initialization, falling back to JS');
                this._cleanup();
                this._startJavaScript();
                return;
            }

            // Track initialization
            if (type === 'initialized') {
                this.initialized = true;
            }

            // Call registered handlers
            const handlers = this.messageHandlers.get(type) || [];
            handlers.forEach(handler => handler(payload, type));
        };

        this.worker.onerror = (err) => {
            console.error('Worker error:', err);
            
            // If WASM worker fails, try fallback
            if (isWASM && !this.initialized) {
                console.warn('WASM worker failed, switching to JavaScript worker');
                this._cleanup();
                this._startJavaScript().then(() => {
                    // Replay pending messages
                    this._replayPendingMessages();
                });
            }
        };
    }

    /**
     * Wait for worker ready signal
     */
    _waitForReady(timeout = 2000) {
        return new Promise((resolve) => {
            let timer = null;
            
            const handler = (payload, type) => {
                if (type === 'ready' || type === 'initialized') {
                    if (timer) clearTimeout(timer);
                    this.off('ready', handler);
                    this.off('initialized', handler);
                    resolve(true);
                }
            };
            
            this.on('ready', handler);
            this.on('initialized', handler);
            
            timer = setTimeout(() => {
                this.off('ready', handler);
                this.off('initialized', handler);
                resolve(false);
            }, timeout);
        });
    }

    /**
     * Register message handler
     */
    on(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    /**
     * Unregister message handler
     */
    off(type, handler) {
        if (!this.messageHandlers.has(type)) return;
        const handlers = this.messageHandlers.get(type);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * Post message to worker
     */
    postMessage(message) {
        if (!this.worker) {
            console.warn('Worker not started, queuing message');
            this.pendingMessages.push(message);
            return;
        }
        
        this.worker.postMessage(message);
    }

    /**
     * Replay pending messages after fallback
     */
    _replayPendingMessages() {
        if (this.pendingMessages.length > 0) {
            console.log(`Replaying ${this.pendingMessages.length} pending messages`);
            this.pendingMessages.forEach(msg => this.worker.postMessage(msg));
            this.pendingMessages = [];
        }
    }

    /**
     * Cleanup worker
     */
    _cleanup() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.initialized = false;
    }

    /**
     * Terminate worker
     */
    terminate() {
        this._cleanup();
        this.messageHandlers.clear();
        this.pendingMessages = [];
        this.usingWASM = false;
    }

    /**
     * Check if using WASM
     */
    isUsingWASM() {
        return this.usingWASM;
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            active: this.worker !== null,
            initialized: this.initialized,
            usingWASM: this.usingWASM,
            pendingMessages: this.pendingMessages.length
        };
    }
}

// Singleton instance
export const plannerWorkerManager = new PlannerWorkerManager();
