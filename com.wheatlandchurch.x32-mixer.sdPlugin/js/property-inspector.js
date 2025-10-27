// Property Inspector JavaScript for X32 Stream Deck Plugin

let websocket = null;
let uuid = null;
let actionInfo = {};

// Initialize the property inspector
function connectElgatoStreamDeckSocket(inPort, inUuid, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUuid;
    actionInfo = JSON.parse(inActionInfo);
    
    websocket = new WebSocket('ws://localhost:' + inPort);
    
    websocket.onopen = function() {
        const registerMessage = {
            "event": inRegisterEvent,
            "uuid": uuid
        };
        websocket.send(JSON.stringify(registerMessage));
        
        // Load existing settings
        loadSettings();
    };
    
    websocket.onmessage = function(evt) {
        const message = JSON.parse(evt.data);
        
        if (message.event === 'didReceiveSettings') {
            loadSettingsFromPayload(message.payload.settings);
        }
    };
}

// Load settings from the action
function loadSettings() {
    if (actionInfo && actionInfo.payload && actionInfo.payload.settings) {
        loadSettingsFromPayload(actionInfo.payload.settings);
    }
}

// Load settings into the UI
function loadSettingsFromPayload(settings) {
    // Load X32 connection settings
    if (settings.x32Host) {
        const hostInput = document.getElementById('x32Host');
        if (hostInput) hostInput.value = settings.x32Host;
    }
    
    if (settings.x32Port) {
        const portInput = document.getElementById('x32Port');
        if (portInput) portInput.value = settings.x32Port;
    }
    
    // Load channel-specific settings
    if (settings.channel) {
        const channelSelect = document.getElementById('channel');
        if (channelSelect) channelSelect.value = settings.channel;
    }
    
    // Load scene-specific settings
    if (settings.scene) {
        const sceneSelect = document.getElementById('scene');
        if (sceneSelect) sceneSelect.value = settings.scene;
    }
    
    if (settings.sceneName) {
        const sceneNameInput = document.getElementById('sceneName');
        if (sceneNameInput) sceneNameInput.value = settings.sceneName;
    }
    
    if (settings.confirmRecall !== undefined) {
        const confirmCheckbox = document.getElementById('confirmRecall');
        if (confirmCheckbox) confirmCheckbox.checked = settings.confirmRecall;
    }
    
    // Load DCA-specific settings
    if (settings.dca) {
        const dcaSelect = document.getElementById('dca');
        if (dcaSelect) dcaSelect.value = settings.dca;
    }
    
    if (settings.dcaName) {
        const dcaNameInput = document.getElementById('dcaName');
        if (dcaNameInput) dcaNameInput.value = settings.dcaName;
    }
    
    // Load fader-specific settings
    if (settings.step) {
        const stepSelect = document.getElementById('step');
        if (stepSelect) stepSelect.value = settings.step;
    }
}

// Save settings to the action
function saveSettings() {
    const settings = {};
    
    // Get X32 connection settings
    const hostInput = document.getElementById('x32Host');
    if (hostInput && hostInput.value.trim()) {
        settings.x32Host = hostInput.value.trim();
    }
    
    const portInput = document.getElementById('x32Port');
    if (portInput && portInput.value) {
        settings.x32Port = parseInt(portInput.value);
    }
    
    // Get channel settings
    const channelSelect = document.getElementById('channel');
    if (channelSelect && channelSelect.value) {
        settings.channel = parseInt(channelSelect.value);
    }
    
    // Get scene settings
    const sceneSelect = document.getElementById('scene');
    if (sceneSelect && sceneSelect.value) {
        settings.scene = parseInt(sceneSelect.value);
    }
    
    const sceneNameInput = document.getElementById('sceneName');
    if (sceneNameInput && sceneNameInput.value.trim()) {
        settings.sceneName = sceneNameInput.value.trim();
    }
    
    const confirmCheckbox = document.getElementById('confirmRecall');
    if (confirmCheckbox) {
        settings.confirmRecall = confirmCheckbox.checked;
    }
    
    // Get DCA settings
    const dcaSelect = document.getElementById('dca');
    if (dcaSelect && dcaSelect.value) {
        settings.dca = parseInt(dcaSelect.value);
    }
    
    const dcaNameInput = document.getElementById('dcaName');
    if (dcaNameInput && dcaNameInput.value.trim()) {
        settings.dcaName = dcaNameInput.value.trim();
    }
    
    // Get fader settings
    const stepSelect = document.getElementById('step');
    if (stepSelect && stepSelect.value) {
        settings.step = parseFloat(stepSelect.value);
    }
    
    // Send settings to the plugin
    if (websocket) {
        const message = {
            "event": "setSettings",
            "context": uuid,
            "payload": settings
        };
        websocket.send(JSON.stringify(message));
    }
}

// Test X32 connection
async function testConnection() {
    const hostInput = document.getElementById('x32Host');
    const portInput = document.getElementById('x32Port');
    const statusDiv = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (!hostInput || !portInput || !statusDiv || !statusText) {
        return;
    }
    
    const host = hostInput.value.trim();
    const port = parseInt(portInput.value) || 10023;
    
    if (!host) {
        showStatus('error', 'Please enter an IP address');
        return;
    }
    
    showStatus('warning', 'Testing connection...');
    
    try {
        // Since we can't directly test the connection from the browser,
        // we'll send a message to the plugin to test it
        if (websocket) {
            const message = {
                "event": "sendToPlugin",
                "context": uuid,
                "payload": {
                    "action": "testConnection",
                    "host": host,
                    "port": port
                }
            };
            websocket.send(JSON.stringify(message));
        }
    } catch (error) {
        showStatus('error', 'Connection test failed');
    }
}

// Show connection status
function showStatus(type, message) {
    const statusDiv = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (!statusDiv || !statusText) return;
    
    statusDiv.style.display = 'flex';
    statusText.textContent = message;
    statusText.className = `status-${type}`;
    
    // Hide status after 5 seconds for success/error messages
    if (type !== 'warning') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Set up event listeners when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add change listeners to all inputs
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', saveSettings);
        input.addEventListener('input', saveSettings);
    });
    
    // Add test connection button listener
    const testButton = document.getElementById('testConnection');
    if (testButton) {
        testButton.addEventListener('click', testConnection);
    }
    
    // Auto-fill scene name when scene number changes
    const sceneSelect = document.getElementById('scene');
    const sceneNameInput = document.getElementById('sceneName');
    if (sceneSelect && sceneNameInput) {
        sceneSelect.addEventListener('change', function() {
            if (this.value && !sceneNameInput.value.trim()) {
                sceneNameInput.value = `Scene ${this.value}`;
                saveSettings();
            }
        });
    }
    
    // Auto-fill DCA name when DCA number changes
    const dcaSelect = document.getElementById('dca');
    const dcaNameInput = document.getElementById('dcaName');
    if (dcaSelect && dcaNameInput) {
        dcaSelect.addEventListener('change', function() {
            if (this.value && !dcaNameInput.value.trim()) {
                dcaNameInput.value = `DCA ${this.value}`;
                saveSettings();
            }
        });
    }
});