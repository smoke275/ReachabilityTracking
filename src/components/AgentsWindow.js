/**
 * AgentsWindow Web Component
 * Floating window for placing and controlling pursuer (intruder) and evader agents
 */
import { eventBus } from '../utils/EventBus.js';

export class AgentsWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 100, y: 100 };
        this.selectedAgent = null; // 'pursuer' or 'evader'
        this.placementMode = null; // 'pursuer' or 'evader' when in placement mode
        this.sensorsSynced = false; // Whether sensor parameters are synchronized
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        
        // Window dragging
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Pursuer controls
        const placePursuerBtn = this.shadowRoot.querySelector('#placePursuer');
        const selectPursuerBtn = this.shadowRoot.querySelector('#selectPursuer');
        const resetPursuerBtn = this.shadowRoot.querySelector('#resetPursuer');

        placePursuerBtn?.addEventListener('click', () => this.enablePlacementMode('pursuer'));
        selectPursuerBtn?.addEventListener('click', () => this.selectAgent('pursuer'));
        resetPursuerBtn?.addEventListener('click', () => this.resetAgent('pursuer'));

        // Evader controls
        const placeEvaderBtn = this.shadowRoot.querySelector('#placeEvader');
        const selectEvaderBtn = this.shadowRoot.querySelector('#selectEvader');
        const resetEvaderBtn = this.shadowRoot.querySelector('#resetEvader');

        placeEvaderBtn?.addEventListener('click', () => this.enablePlacementMode('evader'));
        selectEvaderBtn?.addEventListener('click', () => this.selectAgent('evader'));
        resetEvaderBtn?.addEventListener('click', () => this.resetAgent('evader'));

        // Pursuer sensor sliders
        this.setupSensorSlider('pursuerRmax', 'pursuerRmaxSlider', 'pursuer', 'R_max');
        this.setupSensorSlider('pursuerRmin', 'pursuerRminSlider', 'pursuer', 'R_min');
        this.setupSensorSlider('pursuerFov', 'pursuerFovSlider', 'pursuer', 'fov');

        // Evader sensor sliders
        this.setupSensorSlider('evaderRmax', 'evaderRmaxSlider', 'evader', 'R_max');
        this.setupSensorSlider('evaderRmin', 'evaderRminSlider', 'evader', 'R_min');
        this.setupSensorSlider('evaderFov', 'evaderFovSlider', 'evader', 'fov');

        // Sync button
        const syncBtn = this.shadowRoot.querySelector('#syncSensorsBtn');
        syncBtn?.addEventListener('click', () => this.toggleSensorSync());

        // Listen for keyboard arrow keys when an agent is selected
        this.setupKeyboardControl();

        // Listen for canvas clicks when in placement mode
        eventBus.on('canvas:placeIntruder', (position) => {
            if (this.placementMode === 'pursuer') {
                this.placementMode = null;
                this.updatePlacementModeUI();
                this.updateStatus('Pursuer placed at canvas location', false);
            }
        });

        eventBus.on('canvas:placeEvader', (position) => {
            if (this.placementMode === 'evader') {
                this.placementMode = null;
                this.updatePlacementModeUI();
                this.updateStatus('Evader placed at canvas location', false);
            }
        });

        // Listen for agent position updates
        eventBus.on('intruder:positionUpdate', (state) => {
            if (state && state.position) {
                this.updateAgentInfo('pursuer', state.position);
            }
        });

        eventBus.on('evader:positionUpdate', (data) => {
            if (data && data.position) {
                this.updateAgentInfo('evader', data.position);
            }
        });

        // Listen for sensor detection results
        eventBus.on('sensor:detectionResult', (result) => {
            this.updateDetectionStatus(result);
        });
    }

    setupKeyboardControl() {
        // The IntruderService and app.js handle the actual keyboard events
        // This component just manages the selection state
        // No need for duplicate keyboard listeners here
    }

    setupSensorSlider(displayId, sliderId, agentType, paramName) {
        const slider = this.shadowRoot.querySelector(`#${sliderId}`);
        const display = this.shadowRoot.querySelector(`#${displayId}`);
        
        if (!slider || !display) return;
        
        // Update on input for real-time feedback
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            
            // Update display with proper formatting
            if (paramName === 'fov') {
                display.textContent = `${value}°`;
            } else {
                display.textContent = `${value} px`;
            }
            
            // Emit event to update sensor model immediately for reactive visualization
            const eventName = agentType === 'pursuer' 
                ? 'sensor:updatePursuerParams' 
                : 'sensor:updateEvaderParams';
            
            eventBus.emit(eventName, { [paramName]: value });

            // If synced, update the other agent's slider
            if (this.sensorsSynced) {
                this.syncSliderValue(agentType, paramName, value);
            }
        });
    }

    syncSliderValue(sourceAgent, paramName, value) {
        const targetAgent = sourceAgent === 'pursuer' ? 'evader' : 'pursuer';
        
        // Map parameter names to slider/display IDs
        const paramMap = {
            'R_max': { display: 'Rmax', slider: 'RmaxSlider' },
            'R_min': { display: 'Rmin', slider: 'RminSlider' },
            'fov': { display: 'Fov', slider: 'FovSlider' }
        };
        
        const param = paramMap[paramName];
        if (!param) return;
        
        const targetSliderId = `${targetAgent}${param.slider}`;
        const targetDisplayId = `${targetAgent}${param.display}`;
        
        const targetSlider = this.shadowRoot.querySelector(`#${targetSliderId}`);
        const targetDisplay = this.shadowRoot.querySelector(`#${targetDisplayId}`);
        
        if (targetSlider && targetDisplay) {
            targetSlider.value = value;
            
            // Update display with proper formatting
            if (paramName === 'fov') {
                targetDisplay.textContent = `${value}°`;
            } else {
                targetDisplay.textContent = `${value} px`;
            }
            
            // Emit event to update the target agent's sensor model
            const eventName = targetAgent === 'pursuer' 
                ? 'sensor:updatePursuerParams' 
                : 'sensor:updateEvaderParams';
            
            eventBus.emit(eventName, { [paramName]: value });
        }
    }

    toggleSensorSync() {
        this.sensorsSynced = !this.sensorsSynced;
        
        const syncBtn = this.shadowRoot.querySelector('#syncSensorsBtn');
        const syncIcon = this.shadowRoot.querySelector('#syncSensorsIcon');
        const syncStatus = this.shadowRoot.querySelector('#syncStatus');
        
        if (this.sensorsSynced) {
            // Synced state - active appearance
            syncBtn.style.background = 'var(--md-sys-color-primary-container, #EADDFF)';
            syncBtn.style.color = 'var(--md-sys-color-on-primary-container, #21005D)';
            syncBtn.style.borderColor = 'var(--md-sys-color-primary, #6750A4)';
            if (syncIcon) syncIcon.textContent = 'sync';
            if (syncStatus) {
                syncStatus.textContent = 'SYNCED';
                syncStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
            }
            
            // Sync current pursuer values to evader
            this.syncAllParameters('pursuer');
            
            this.updateStatus('Sensor parameters synchronized', false);
        } else {
            // Unsynced state - default appearance
            syncBtn.style.background = 'var(--md-sys-color-surface-container-high, #ECE6F0)';
            syncBtn.style.color = 'var(--md-sys-color-on-surface, #1C1B1F)';
            syncBtn.style.borderColor = 'var(--md-sys-color-outline, #79747E)';
            if (syncIcon) syncIcon.textContent = 'sync_disabled';
            if (syncStatus) {
                syncStatus.textContent = 'INDEPENDENT';
                syncStatus.style.color = 'var(--md-sys-color-on-surface-variant, #49454F)';
            }
            
            this.updateStatus('Sensor parameters independent', false);
        }
    }

    syncAllParameters(sourceAgent) {
        // Sync all three parameters from source to target
        const params = ['R_max', 'R_min', 'fov'];
        const sourcePrefix = sourceAgent;
        
        params.forEach(paramName => {
            const paramMap = {
                'R_max': 'RmaxSlider',
                'R_min': 'RminSlider',
                'fov': 'FovSlider'
            };
            
            const sourceSliderId = `${sourcePrefix}${paramMap[paramName]}`;
            const sourceSlider = this.shadowRoot.querySelector(`#${sourceSliderId}`);
            
            if (sourceSlider) {
                const value = parseFloat(sourceSlider.value);
                this.syncSliderValue(sourceAgent, paramName, value);
            }
        });
    }

    enablePlacementMode(agentType) {
        this.placementMode = agentType;
        this.updatePlacementModeUI();
        
        if (agentType === 'pursuer') {
            this.updateStatus('Click on canvas to place pursuer', false);
            // Enable intruder placement mode
            eventBus.emit('agents:enablePursuerPlacement');
        } else if (agentType === 'evader') {
            this.updateStatus('Click on canvas to place evader', false);
            // Enable evader placement mode
            eventBus.emit('agents:enableEvaderPlacement');
        }
    }

    selectAgent(agentType) {
        if (this.selectedAgent === agentType) {
            // Deselect if clicking the same agent
            this.selectedAgent = null;
            this.updateStatus('Agent deselected. Arrow keys disabled.', false);
            
            // Deactivate both agents
            eventBus.emit('agents:deactivatePursuer');
            eventBus.emit('agents:deactivateEvader');
        } else {
            // Deselect the other agent first
            if (this.selectedAgent === 'pursuer') {
                eventBus.emit('agents:deactivatePursuer');
            } else if (this.selectedAgent === 'evader') {
                eventBus.emit('agents:deactivateEvader');
            }
            
            this.selectedAgent = agentType;
            this.updateStatus(`${agentType === 'pursuer' ? 'Pursuer' : 'Evader'} selected. Use arrow keys to move.`, false);
            
            // Activate the agent's control system
            if (agentType === 'pursuer') {
                eventBus.emit('agents:activatePursuer');
            } else if (agentType === 'evader') {
                eventBus.emit('agents:activateEvader');
            }
        }
        this.updateSelectionUI();
    }

    resetAgent(agentType) {
        if (agentType === 'pursuer') {
            eventBus.emit('intruder:reset');
            this.updateStatus('Pursuer reset', false);
            if (this.selectedAgent === 'pursuer') {
                this.selectedAgent = null;
                this.updateSelectionUI();
            }
        } else if (agentType === 'evader') {
            eventBus.emit('evader:reset');
            this.updateStatus('Evader reset', false);
            if (this.selectedAgent === 'evader') {
                this.selectedAgent = null;
                this.updateSelectionUI();
            }
        }
    }

    updatePlacementModeUI() {
        const placePursuerBtn = this.shadowRoot.querySelector('#placePursuer');
        const placeEvaderBtn = this.shadowRoot.querySelector('#placeEvader');
        
        if (placePursuerBtn) {
            if (this.placementMode === 'pursuer') {
                // Bright orange to indicate placement mode is active
                placePursuerBtn.style.setProperty('--md-filled-tonal-button-container-color', '#FF9800');
                placePursuerBtn.style.setProperty('--md-filled-tonal-button-label-text-color', '#000000');
            } else {
                placePursuerBtn.style.removeProperty('--md-filled-tonal-button-container-color');
                placePursuerBtn.style.removeProperty('--md-filled-tonal-button-label-text-color');
            }
        }
        
        if (placeEvaderBtn) {
            if (this.placementMode === 'evader') {
                // Bright orange to indicate placement mode is active
                placeEvaderBtn.style.setProperty('--md-filled-tonal-button-container-color', '#FF9800');
                placeEvaderBtn.style.setProperty('--md-filled-tonal-button-label-text-color', '#000000');
            } else {
                placeEvaderBtn.style.removeProperty('--md-filled-tonal-button-container-color');
                placeEvaderBtn.style.removeProperty('--md-filled-tonal-button-label-text-color');
            }
        }
    }

    updateSelectionUI() {
        const selectPursuerBtn = this.shadowRoot.querySelector('#selectPursuer');
        const selectEvaderBtn = this.shadowRoot.querySelector('#selectEvader');
        
        if (selectPursuerBtn) {
            if (this.selectedAgent === 'pursuer') {
                // Bright blue to indicate pursuer is selected and keyboard-controllable
                selectPursuerBtn.style.setProperty('--md-filled-tonal-button-container-color', '#2196F3');
                selectPursuerBtn.style.setProperty('--md-filled-tonal-button-label-text-color', '#FFFFFF');
            } else {
                selectPursuerBtn.style.removeProperty('--md-filled-tonal-button-container-color');
                selectPursuerBtn.style.removeProperty('--md-filled-tonal-button-label-text-color');
            }
        }
        
        if (selectEvaderBtn) {
            if (this.selectedAgent === 'evader') {
                // Bright pink/red to indicate evader is selected and keyboard-controllable
                selectEvaderBtn.style.setProperty('--md-filled-tonal-button-container-color', '#E91E63');
                selectEvaderBtn.style.setProperty('--md-filled-tonal-button-label-text-color', '#FFFFFF');
            } else {
                selectEvaderBtn.style.removeProperty('--md-filled-tonal-button-container-color');
                selectEvaderBtn.style.removeProperty('--md-filled-tonal-button-label-text-color');
            }
        }
    }

    updateAgentInfo(agentType, position) {
        const infoEl = this.shadowRoot.querySelector(`#${agentType}Info`);
        if (infoEl && position) {
            infoEl.textContent = `Position: (${Math.round(position.x)}, ${Math.round(position.y)})`;
            infoEl.style.display = 'block';
        }
    }

    updateStatus(message, isError = false) {
        const statusEl = this.shadowRoot.querySelector('#statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError 
                ? 'var(--md-sys-color-error, #BA1A1A)' 
                : 'var(--md-sys-color-on-surface-variant, #49454F)';
        }
    }

    updateDetectionStatus(result) {
        // Update pursuer detection status
        const pursuerStatusEl = this.shadowRoot.querySelector('#pursuerDetectionStatus');
        const pursuerIconEl = this.shadowRoot.querySelector('#pursuerDetectionIcon');
        if (pursuerStatusEl && pursuerIconEl) {
            if (result.pursuerSeesEvader) {
                pursuerStatusEl.textContent = 'DETECTED';
                pursuerStatusEl.style.color = '#4CAF50';
                pursuerIconEl.textContent = 'check_circle';
                pursuerIconEl.style.color = '#4CAF50';
            } else {
                pursuerStatusEl.textContent = 'NOT DETECTED';
                pursuerStatusEl.style.color = '#F44336';
                pursuerIconEl.textContent = 'cancel';
                pursuerIconEl.style.color = '#F44336';
            }
        }

        // Update evader detection status
        const evaderStatusEl = this.shadowRoot.querySelector('#evaderDetectionStatus');
        const evaderIconEl = this.shadowRoot.querySelector('#evaderDetectionIcon');
        if (evaderStatusEl && evaderIconEl) {
            if (result.evaderSeesPursuer) {
                evaderStatusEl.textContent = 'DETECTED';
                evaderStatusEl.style.color = '#FF9800';
                evaderIconEl.textContent = 'check_circle';
                evaderIconEl.style.color = '#FF9800';
            } else {
                evaderStatusEl.textContent = 'NOT DETECTED';
                evaderStatusEl.style.color = '#F44336';
                evaderIconEl.textContent = 'cancel';
                evaderIconEl.style.color = '#F44336';
            }
        }

        // Update distance
        const distanceEl = this.shadowRoot.querySelector('#detectionDistance');
        if (distanceEl && result.distance !== null && result.distance !== undefined) {
            distanceEl.textContent = `${Math.round(result.distance)} px`;
        }
    }

    startDragging(e) {
        if (e.target.closest('.close-btn') || e.target.closest('.minimize-btn')) return;
        this.isDragging = true;
        const container = this.shadowRoot.querySelector('.window-container');
        const rect = container.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        container.style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            this.position.x = Math.max(0, Math.min(window.innerWidth - rect.width, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - rect.height, this.position.y));
        }
        this.updatePosition();
    }

    stopDragging() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.shadowRoot.querySelector('.window-container').style.cursor = 'default';
    }

    updatePosition() {
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.left = `${this.position.x}px`;
            container.style.top = `${this.position.y}px`;
        }
    }

    close() {
        this.removeAttribute('visible');
        this.selectedAgent = null;
        this.placementMode = null;
        eventBus.emit('agents:windowClosed');
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const icon = this.shadowRoot.querySelector('.minimize-btn md-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            icon.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            icon.textContent = 'add';
        }
    }

    show() {
        this.setAttribute('visible', '');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                }
                
                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }
                
                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #FFF4E6);
                    color: var(--floating-on-surface, #3E2723);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 380px;
                    max-width: 450px;
                    overflow: hidden;
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: var(--md-sys-color-tertiary-container, #FFD8E4);
                    cursor: grab;
                    user-select: none;
                }
                
                .window-header:active {
                    cursor: grabbing;
                }
                
                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--md-sys-color-on-tertiary-container, #31111D);
                }
                
                .window-controls {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .window-content {
                    padding: 1.5rem;
                    max-height: 500px;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    scrollbar-width: thin;
                }
                
                .window-content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .window-content::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .window-content::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.25);
                    border-radius: 4px;
                }
                
                .agent-section {
                    margin-bottom: 1.25rem;
                    padding: 1rem;
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    border-radius: 8px;
                    border-left: 4px solid transparent;
                }
                
                .agent-section.pursuer {
                    border-left-color: #2196F3;
                }
                
                .agent-section.evader {
                    border-left-color: #E91E63;
                }
                
                .sensor-section {
                    margin-bottom: 1.25rem;
                    padding: 1rem;
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    border-radius: 8px;
                    border-left: 4px solid transparent;
                }
                
                .sensor-section.pursuer {
                    border-left-color: #2196F3;
                }
                
                .sensor-section.evader {
                    border-left-color: #E91E63;
                }
                
                .section-divider {
                    margin: 1.5rem 0;
                    padding: 0.5rem;
                    background: var(--md-sys-color-secondary-container, #E8DEF8);
                    color: var(--md-sys-color-on-secondary-container, #1D192B);
                    border-radius: 8px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .section-divider md-icon {
                    font-size: 20px;
                }
                
                .sync-control {
                    margin: 1rem 0;
                    padding: 0.75rem;
                    background: var(--md-sys-color-surface, #FFF);
                    border: 1px solid var(--md-sys-color-outline, #79747E);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .sync-info {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                
                .sync-info md-icon {
                    font-size: 24px;
                    color: var(--md-sys-color-primary, #6750A4);
                }
                
                .sync-text {
                    display: flex;
                    flex-direction: column;
                    gap: 0.1rem;
                }
                
                .sync-text .sync-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                }
                
                .sync-text .sync-description {
                    font-size: 0.75rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                }
                
                .sync-button-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.2rem;
                }
                
                #syncSensorsBtn {
                    padding: 0.4rem 0.8rem;
                    background: var(--md-sys-color-surface-container-high, #ECE6F0);
                    border: 1px solid var(--md-sys-color-outline, #79747E);
                    border-radius: 6px;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                    font-weight: 600;
                    font-size: 0.8rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    transition: all 0.2s ease;
                }
                
                #syncSensorsBtn:hover {
                    background: var(--md-sys-color-surface-container-highest, #E6E0E9);
                }
                
                #syncStatus {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    font-family: 'Roboto Mono', monospace;
                }
                
                .agent-header {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 0.95rem;
                    font-weight: 600;
                    margin-bottom: 0.75rem;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                }
                
                .agent-info {
                    font-size: 0.8rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    margin-bottom: 0.75rem;
                    font-family: 'Roboto Mono', monospace;
                    display: none;
                    padding: 0.4rem;
                    background: rgba(0,0,0,0.04);
                    border-radius: 4px;
                }
                
                .button-group {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                
                md-filled-tonal-button {
                    flex: 1;
                    min-width: 100px;
                }
                
                .info-box {
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    line-height: 1.5;
                    padding: 1rem;
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    border-radius: 8px;
                    margin-bottom: 1.25rem;
                }
                
                .info-box md-icon {
                    vertical-align: middle;
                    margin-right: 0.5rem;
                }
                
                .status-message {
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    padding: 0.75rem;
                    background: var(--md-sys-color-surface-container, #F3EDF7);
                    border-radius: 8px;
                    text-align: center;
                    min-height: 2.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 500;
                    border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                /* Sensor Controls */
                .sensor-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .sensor-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.95rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                }
                
                .slider-row {
                    margin-bottom: 0.5rem;
                }
                
                .slider-row label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    margin-bottom: 0.2rem;
                }
                
                .slider-row label .param-value {
                    color: var(--md-sys-color-primary, #6750A4);
                    font-weight: 600;
                    font-family: 'Roboto Mono', monospace;
                    font-size: 0.85rem;
                    padding: 0.1rem 0.4rem;
                    background: var(--md-sys-color-surface-container-high, #ECE6F0);
                    border-radius: 4px;
                }
                
                md-slider {
                    width: 100%;
                }
                
                /* Detection Status */
                .detection-status {
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: var(--md-sys-color-surface-container-low, #F7F2FA);
                    border-radius: 8px;
                    border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                .detection-status-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                .detection-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                .detection-row:last-child {
                    border-bottom: none;
                }
                
                .detection-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                }
                
                .detection-value {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    font-family: 'Roboto Mono', monospace;
                    padding: 0.2rem 0.5rem;
                    background: var(--md-sys-color-surface, #FFF);
                    border-radius: 4px;
                    border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                .distance-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                .distance-info .distance-value {
                    font-weight: 600;
                    font-family: 'Roboto Mono', monospace;
                    color: var(--md-sys-color-primary, #6750A4);
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>group</md-icon>
                        <span>Agent Control</span>
                    </div>
                    <div class="window-controls">
                        <md-icon-button class="minimize-btn">
                            <md-icon>remove</md-icon>
                        </md-icon-button>
                        <md-icon-button class="close-btn">
                            <md-icon>close</md-icon>
                        </md-icon-button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="info-box">
                        <md-icon>info</md-icon>
                        Place and control agents. Use arrow keys to move the selected agent.
                    </div>
                    
                    <!-- Agent Placement Section -->
                    <div class="agent-section pursuer">
                        <div class="agent-header">
                            <md-icon style="color: #2196F3;">gps_fixed</md-icon>
                            Pursuer (Intruder)
                        </div>
                        <div id="pursuerInfo" class="agent-info">Not placed</div>
                        <div class="button-group">
                            <md-filled-tonal-button id="placePursuer">
                                <md-icon slot="icon">add_location</md-icon>
                                Place
                            </md-filled-tonal-button>
                            <md-filled-tonal-button id="selectPursuer">
                                <md-icon slot="icon">radio_button_checked</md-icon>
                                Select
                            </md-filled-tonal-button>
                            <md-filled-tonal-button id="resetPursuer">
                                <md-icon slot="icon">refresh</md-icon>
                                Reset
                            </md-filled-tonal-button>
                        </div>
                    </div>
                    
                    <div class="agent-section evader">
                        <div class="agent-header">
                            <md-icon style="color: #E91E63;">directions_run</md-icon>
                            Evader
                        </div>
                        <div id="evaderInfo" class="agent-info">Not placed</div>
                        <div class="button-group">
                            <md-filled-tonal-button id="placeEvader">
                                <md-icon slot="icon">add_location</md-icon>
                                Place
                            </md-filled-tonal-button>
                            <md-filled-tonal-button id="selectEvader">
                                <md-icon slot="icon">radio_button_checked</md-icon>
                                Select
                            </md-filled-tonal-button>
                            <md-filled-tonal-button id="resetEvader">
                                <md-icon slot="icon">refresh</md-icon>
                                Reset
                            </md-filled-tonal-button>
                        </div>
                    </div>
                    
                    <!-- Sensor Models Section Divider -->
                    <div class="section-divider">
                        <md-icon>sensors</md-icon>
                        <span>Sensor Models</span>
                    </div>
                    
                    <!-- Sync Control -->
                    <div class="sync-control">
                        <div class="sync-info">
                            <md-icon>sync_alt</md-icon>
                            <div class="sync-text">
                                <span class="sync-title">Synchronize Sensors</span>
                                <span class="sync-description">Link parameters between agents</span>
                            </div>
                        </div>
                        <div class="sync-button-wrapper">
                            <button id="syncSensorsBtn">
                                <md-icon id="syncSensorsIcon">sync_disabled</md-icon>
                                <span>Sync</span>
                            </button>
                            <span id="syncStatus">INDEPENDENT</span>
                        </div>
                    </div>
                    
                    <!-- Pursuer Sensor Controls -->
                    <div class="sensor-section pursuer">
                        <div class="sensor-title">
                            <md-icon style="color: #2196F3;">radar</md-icon>
                            Pursuer Sensor
                        </div>
                        <div class="sensor-controls">
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Max Range (R_max)</span>
                                    <span class="param-value" id="pursuerRmax">150 px</span>
                                </label>
                                <md-slider id="pursuerRmaxSlider" min="50" max="300" value="150" step="10"></md-slider>
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Blind Spot (R_min)</span>
                                    <span class="param-value" id="pursuerRmin">20 px</span>
                                </label>
                                <md-slider id="pursuerRminSlider" min="0" max="100" value="20" step="5"></md-slider>
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Field of View (FOV)</span>
                                    <span class="param-value" id="pursuerFov">360°</span>
                                </label>
                                <md-slider id="pursuerFovSlider" min="30" max="360" value="360" step="15"></md-slider>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Evader Sensor Controls -->
                    <div class="sensor-section evader">
                        <div class="sensor-title">
                            <md-icon style="color: #E91E63;">radar</md-icon>
                            Evader Sensor
                        </div>
                        <div class="sensor-controls">
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Max Range (R_max)</span>
                                    <span class="param-value" id="evaderRmax">120 px</span>
                                </label>
                                <md-slider id="evaderRmaxSlider" min="50" max="300" value="120" step="10"></md-slider>
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Blind Spot (R_min)</span>
                                    <span class="param-value" id="evaderRmin">15 px</span>
                                </label>
                                <md-slider id="evaderRminSlider" min="0" max="100" value="15" step="5"></md-slider>
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Field of View (FOV)</span>
                                    <span class="param-value" id="evaderFov">270°</span>
                                </label>
                                <md-slider id="evaderFovSlider" min="30" max="360" value="270" step="15"></md-slider>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Detection Status Section -->
                    <div class="detection-status">
                        <div class="detection-status-title">
                            <md-icon>visibility</md-icon>
                            <span>Detection Status</span>
                        </div>
                        <div class="detection-row">
                            <div class="detection-label">
                                <md-icon style="color: #2196F3;">gps_fixed</md-icon>
                                <span>Pursuer sees Evader</span>
                            </div>
                            <div class="detection-value">
                                <md-icon id="pursuerDetectionIcon">cancel</md-icon>
                                <span id="pursuerDetectionStatus">NOT DETECTED</span>
                            </div>
                        </div>
                        <div class="detection-row">
                            <div class="detection-label">
                                <md-icon style="color: #E91E63;">directions_run</md-icon>
                                <span>Evader sees Pursuer</span>
                            </div>
                            <div class="detection-value">
                                <md-icon id="evaderDetectionIcon">cancel</md-icon>
                                <span id="evaderDetectionStatus">NOT DETECTED</span>
                            </div>
                        </div>
                        <div class="distance-info">
                            <md-icon>straighten</md-icon>
                            <span>Distance:</span>
                            <span class="distance-value" id="detectionDistance">— px</span>
                        </div>
                    </div>
                    
                    <div id="statusMessage" class="status-message">
                        Ready to place agents
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('agents-window', AgentsWindow);
