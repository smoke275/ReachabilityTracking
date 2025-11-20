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
            syncBtn.style.background = '#9C27B0';
            syncBtn.style.color = '#FFFFFF';
            syncBtn.style.boxShadow = '0 0 10px rgba(156, 39, 176, 0.6)';
            if (syncIcon) syncIcon.textContent = 'sync';
            if (syncStatus) {
                syncStatus.textContent = 'SYNCED';
                syncStatus.style.color = '#9C27B0';
            }
            
            // Sync current pursuer values to evader
            this.syncAllParameters('pursuer');
            
            this.updateStatus('Sensor parameters synchronized', false);
        } else {
            // Unsynced state - default appearance
            syncBtn.style.background = '';
            syncBtn.style.color = '';
            syncBtn.style.boxShadow = '';
            if (syncIcon) syncIcon.textContent = 'sync_disabled';
            if (syncStatus) {
                syncStatus.textContent = 'INDEPENDENT';
                syncStatus.style.color = '#78909C';
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
                placePursuerBtn.style.background = '#FF9800';
                placePursuerBtn.style.color = '#000000';
                placePursuerBtn.style.fontWeight = '600';
                placePursuerBtn.style.boxShadow = '0 0 8px rgba(255, 152, 0, 0.6)';
            } else {
                placePursuerBtn.style.background = '';
                placePursuerBtn.style.color = '';
                placePursuerBtn.style.fontWeight = '';
                placePursuerBtn.style.boxShadow = '';
            }
        }
        
        if (placeEvaderBtn) {
            if (this.placementMode === 'evader') {
                // Bright orange to indicate placement mode is active
                placeEvaderBtn.style.background = '#FF9800';
                placeEvaderBtn.style.color = '#000000';
                placeEvaderBtn.style.fontWeight = '600';
                placeEvaderBtn.style.boxShadow = '0 0 8px rgba(255, 152, 0, 0.6)';
            } else {
                placeEvaderBtn.style.background = '';
                placeEvaderBtn.style.color = '';
                placeEvaderBtn.style.fontWeight = '';
                placeEvaderBtn.style.boxShadow = '';
            }
        }
    }

    updateSelectionUI() {
        const selectPursuerBtn = this.shadowRoot.querySelector('#selectPursuer');
        const selectEvaderBtn = this.shadowRoot.querySelector('#selectEvader');
        
        if (selectPursuerBtn) {
            if (this.selectedAgent === 'pursuer') {
                // Bright blue to indicate pursuer is selected and keyboard-controllable
                selectPursuerBtn.style.background = '#2196F3';
                selectPursuerBtn.style.color = '#FFFFFF';
                selectPursuerBtn.style.fontWeight = '600';
                selectPursuerBtn.style.boxShadow = '0 0 8px rgba(33, 150, 243, 0.6)';
            } else {
                selectPursuerBtn.style.background = '';
                selectPursuerBtn.style.color = '';
                selectPursuerBtn.style.fontWeight = '';
                selectPursuerBtn.style.boxShadow = '';
            }
        }
        
        if (selectEvaderBtn) {
            if (this.selectedAgent === 'evader') {
                // Bright pink/red to indicate evader is selected and keyboard-controllable
                selectEvaderBtn.style.background = '#E91E63';
                selectEvaderBtn.style.color = '#FFFFFF';
                selectEvaderBtn.style.fontWeight = '600';
                selectEvaderBtn.style.boxShadow = '0 0 8px rgba(233, 30, 99, 0.6)';
            } else {
                selectEvaderBtn.style.background = '';
                selectEvaderBtn.style.color = '';
                selectEvaderBtn.style.fontWeight = '';
                selectEvaderBtn.style.boxShadow = '';
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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #FFFFFF;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    min-width: 380px;
                    max-width: 450px;
                    overflow: hidden;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.25rem;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(10px);
                    cursor: grab;
                    user-select: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .window-header:active {
                    cursor: grabbing;
                }
                
                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #FFFFFF;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .window-title md-icon {
                    font-size: 28px;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }
                
                .window-controls {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .window-controls md-icon-button {
                    --md-icon-button-icon-color: #FFFFFF;
                }
                
                .window-content {
                    padding: 1.5rem;
                    background: #f8f9fa;
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
                    padding: 1.25rem;
                    background: #FFFFFF;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border-left: 4px solid transparent;
                    transition: all 0.3s ease;
                }
                
                .agent-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }
                
                .agent-section.pursuer {
                    border-left-color: #2196F3;
                    background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
                }
                
                .agent-section.evader {
                    border-left-color: #E91E63;
                    background: linear-gradient(135deg, #ffffff 0%, #fce4ec 100%);
                }
                
                .sensor-section {
                    margin-bottom: 1.25rem;
                    padding: 1.25rem;
                    background: #FFFFFF;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border-left: 4px solid transparent;
                    transition: all 0.3s ease;
                }
                
                .sensor-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }
                
                .sensor-section.pursuer {
                    border-left-color: #2196F3;
                    background: linear-gradient(135deg, #ffffff 0%, #e1f5fe 100%);
                }
                
                .sensor-section.evader {
                    border-left-color: #E91E63;
                    background: linear-gradient(135deg, #ffffff 0%, #fce4ec 100%);
                }
                
                .agent-section:last-of-type {
                    margin-bottom: 1rem;
                }
                
                .section-divider {
                    margin: 1.5rem 0;
                    padding: 0.75rem;
                    background: linear-gradient(135deg, #9c27b0 0%, #673ab7 100%);
                    border-radius: 8px;
                    text-align: center;
                    color: #FFFFFF;
                    font-weight: 700;
                    font-size: 0.95rem;
                    box-shadow: 0 2px 8px rgba(156, 39, 176, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .section-divider md-icon {
                    font-size: 22px;
                }
                
                .sync-control {
                    margin: 1rem 0;
                    padding: 1rem;
                    background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                    border-radius: 10px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border: 2px solid rgba(156, 39, 176, 0.2);
                }
                
                .sync-info {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                
                .sync-info md-icon {
                    font-size: 24px;
                    color: #9C27B0;
                }
                
                .sync-text {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                }
                
                .sync-text .sync-title {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #37474f;
                }
                
                .sync-text .sync-description {
                    font-size: 0.75rem;
                    color: #78909C;
                    line-height: 1.3;
                }
                
                .sync-button-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.3rem;
                }
                
                #syncSensorsBtn {
                    padding: 0.6rem 1.2rem;
                    background: #E0E0E0;
                    border: 2px solid #9C27B0;
                    border-radius: 8px;
                    color: #9C27B0;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                #syncSensorsBtn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(156, 39, 176, 0.3);
                }
                
                #syncSensorsBtn md-icon {
                    font-size: 20px;
                }
                
                #syncStatus {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #78909C;
                    font-family: 'Courier New', monospace;
                    letter-spacing: 0.5px;
                }
                
                .agent-header {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 1rem;
                    font-weight: 700;
                    margin-bottom: 0.85rem;
                    color: #2c3e50;
                }
                
                .agent-header md-icon {
                    font-size: 24px;
                    font-weight: bold;
                }
                
                .agent-info {
                    font-size: 0.85rem;
                    color: #546e7a;
                    margin-bottom: 0.85rem;
                    font-family: 'Courier New', monospace;
                    display: none;
                    padding: 0.5rem;
                    background: rgba(0,0,0,0.04);
                    border-radius: 6px;
                    font-weight: 600;
                }
                
                .button-group {
                    display: flex;
                    gap: 0.6rem;
                    flex-wrap: wrap;
                }
                
                md-filled-tonal-button {
                    flex: 1;
                    min-width: 115px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    --md-filled-tonal-button-container-height: 42px;
                }
                
                .info-box {
                    font-size: 0.9rem;
                    color: #FFFFFF;
                    line-height: 1.6;
                    padding: 1rem 1.25rem;
                    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                    border-radius: 10px;
                    margin-bottom: 1.25rem;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                    font-weight: 500;
                }
                
                .info-box md-icon {
                    vertical-align: middle;
                    margin-right: 0.5rem;
                    font-size: 22px;
                }
                
                .status-message {
                    font-size: 0.9rem;
                    color: #2c3e50;
                    padding: 0.85rem;
                    background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
                    border-radius: 8px;
                    text-align: center;
                    min-height: 2.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    box-shadow: 0 2px 6px rgba(255, 235, 59, 0.3);
                    border: 1px solid rgba(251, 192, 45, 0.3);
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
                    font-size: 1rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                    color: #2c3e50;
                }
                
                .sensor-title md-icon {
                    font-size: 24px;
                }
                
                .slider-row {
                    margin-bottom: 0.5rem;
                }
                
                .slider-row label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #37474f;
                    margin-bottom: 0.4rem;
                }
                
                .slider-row label .param-name {
                    font-weight: 700;
                    color: #455a64;
                }
                
                .slider-row label .param-value {
                    color: #2196F3;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem;
                    padding: 0.2rem 0.5rem;
                    background: rgba(33, 150, 243, 0.1);
                    border-radius: 4px;
                }
                
                .slider-row input[type="range"] {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: linear-gradient(to right, #bbdefb 0%, #2196F3 100%);
                    outline: none;
                    -webkit-appearance: none;
                }
                
                .slider-row input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #2196F3;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(33, 150, 243, 0.4);
                    transition: all 0.2s ease;
                }
                
                .slider-row input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 3px 10px rgba(33, 150, 243, 0.6);
                }
                
                .slider-row input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #2196F3;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 6px rgba(33, 150, 243, 0.4);
                    transition: all 0.2s ease;
                }
                
                .slider-row input[type="range"]::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 3px 10px rgba(33, 150, 243, 0.6);
                }
                
                .evader .slider-row label .param-value {
                    color: #E91E63;
                    background: rgba(233, 30, 99, 0.1);
                }
                
                .evader .slider-row input[type="range"] {
                    background: linear-gradient(to right, #f8bbd0 0%, #E91E63 100%);
                }
                
                .evader .slider-row input[type="range"]::-webkit-slider-thumb {
                    background: #E91E63;
                    box-shadow: 0 2px 6px rgba(233, 30, 99, 0.4);
                }
                
                .evader .slider-row input[type="range"]::-webkit-slider-thumb:hover {
                    box-shadow: 0 3px 10px rgba(233, 30, 99, 0.6);
                }
                
                .evader .slider-row input[type="range"]::-moz-range-thumb {
                    background: #E91E63;
                    box-shadow: 0 2px 6px rgba(233, 30, 99, 0.4);
                }
                
                .evader .slider-row input[type="range"]::-moz-range-thumb:hover {
                    box-shadow: 0 3px 10px rgba(233, 30, 99, 0.6);
                }
                
                /* Detection Status */
                .detection-status {
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: linear-gradient(135deg, #263238 0%, #37474f 100%);
                    border-radius: 10px;
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                }
                
                .detection-status-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #FFFFFF;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
                }
                
                .detection-status-title md-icon {
                    font-size: 22px;
                }
                
                .detection-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.65rem 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .detection-row:last-child {
                    border-bottom: none;
                }
                
                .detection-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }
                
                .detection-label md-icon {
                    font-size: 20px;
                }
                
                .detection-value {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.8rem;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    padding: 0.3rem 0.6rem;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 6px;
                }
                
                .detection-value md-icon {
                    font-size: 18px;
                }
                
                .distance-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.8);
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .distance-info md-icon {
                    font-size: 18px;
                    color: #64B5F6;
                }
                
                .distance-info .distance-value {
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    color: #64B5F6;
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
                                <input type="range" id="pursuerRmaxSlider" min="50" max="300" value="150" step="10">
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Blind Spot (R_min)</span>
                                    <span class="param-value" id="pursuerRmin">20 px</span>
                                </label>
                                <input type="range" id="pursuerRminSlider" min="0" max="100" value="20" step="5">
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Field of View (FOV)</span>
                                    <span class="param-value" id="pursuerFov">360°</span>
                                </label>
                                <input type="range" id="pursuerFovSlider" min="30" max="360" value="360" step="15">
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
                                <input type="range" id="evaderRmaxSlider" min="50" max="300" value="120" step="10">
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Blind Spot (R_min)</span>
                                    <span class="param-value" id="evaderRmin">15 px</span>
                                </label>
                                <input type="range" id="evaderRminSlider" min="0" max="100" value="15" step="5">
                            </div>
                            <div class="slider-row">
                                <label>
                                    <span class="param-name">Field of View (FOV)</span>
                                    <span class="param-value" id="evaderFov">270°</span>
                                </label>
                                <input type="range" id="evaderFovSlider" min="30" max="360" value="270" step="15">
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
