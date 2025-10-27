# Installation Instructions

## Prerequisites

1. **Stream Deck Software**: Download and install from [Elgato's website](https://www.elgato.com/downloads)
   - **Minimum Version**: 6.6+ (required for Stream Deck+ dial support)
2. **Node.js**: Download version 20+ from [nodejs.org](https://nodejs.org/) (for development only)

## Method 1: Release Installation (Recommended)

1. Go to the [Releases page](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/releases)
2. Download the latest `.streamDeckPlugin` file
3. Double-click the file to install
4. The plugin will appear in Stream Deck under **"Behringer X32"** category
5. Actions will be available for both buttons and dials (Stream Deck+ only)

## Method 2: Development Installation

### Step 1: Install Development Tools
```bash
# Install Stream Deck CLI globally
npm install -g @elgato/cli

# Clone the repository
git clone https://github.com/Wheatlandchurch/x32-streamdeck-plugin.git
cd x32-streamdeck-plugin

# Install dependencies
npm install
```

### Step 2: Build and Install
```bash
# Build the plugin
npm run build

# Or build and watch for changes during development
npm run watch
```

The plugin will automatically install into Stream Deck during the build process.

## X32 Mixer Network Setup

### Step 1: Connect X32 to Network
1. Connect Ethernet cable from your router/switch to the X32's Ethernet port
2. Power on the X32 mixer

### Step 2: Configure Network Settings
1. On the X32, navigate to: **Setup** → **Config** → **Network**
2. Configure network settings:
   - **DHCP**: Enable for automatic IP assignment, or
   - **Static IP**: Set manually (recommended for reliability)
     - IP Address: e.g., `192.168.1.100`
     - Subnet Mask: e.g., `255.255.255.0`
     - Gateway: Your router's IP (e.g., `192.168.1.1`)

### Step 3: Verify Connectivity
1. Note the X32's IP address from the network settings
2. From your computer, open Command Prompt/Terminal
3. Test connectivity: `ping [X32-IP-ADDRESS]`
4. You should see successful ping responses

## Plugin Configuration

### Step 1: Add Actions to Stream Deck
1. Open Stream Deck software
2. Locate **"Behringer X32"** in the actions list 
3. Available actions:
   - **Channel Mute**: Basic mute control for any channel
   - **Channel Fader**: Enhanced fader control (⭐ optimized for Stream Deck+ dials)
   - **Scene Recall**: Load and recall mixer scenes
   - **DCA Control**: Control DCA group muting
   - **Mute Group**: Control X32 mute groups (⭐ new feature)
4. Drag desired actions to Stream Deck buttons or dials (Stream Deck+ only)

### Step 2: Configure Each Action
1. Select a button/dial with an X32 action
2. In the Property Inspector panel, configure:
   - **X32 IP Address**: Enter your mixer's IP (e.g., `192.168.1.100`)
   - **X32 Port**: Enter `10023` (default OSC port)
   - **Action-specific settings**: Channel number, scene number, etc.

### Step 3: Stream Deck+ Dial Configuration (Enhanced Features)
For **Channel Fader** actions on Stream Deck+ dials:
1. **Dial Press Action** (choose one):
   - **Mute/Unmute** (recommended): Press dial to toggle channel mute
   - **Unity Gain**: Press dial to set fader to 0dB reference level
   - **Fine Adjustment**: Hold dial while rotating for precision control
2. **Step Size Configuration**:
   - **Normal Step**: Regular rotation adjustment (1%-10%, default: 5%)
   - **Fine Step**: Precision adjustment increment (0.1%-2.5%, default: 1%)

### Step 4: Test and Verify
3. Click "Test X32 Connection" to verify setup
4. Look for "Connection successful" message

### Step 3: Test Functionality
1. Press the configured buttons to test functionality
2. Check that mixer responds to commands
3. Verify button states update correctly (for mute actions)

## Troubleshooting Installation

### Plugin Not Appearing in Stream Deck
1. Restart Stream Deck software
2. Check if plugin file was corrupted during download
3. Try running Stream Deck as administrator (Windows) or with sudo (macOS)

### Connection Test Fails
1. **Verify IP Address**: Double-check X32 IP in mixer settings
2. **Network Issues**: Ensure both devices are on same network
3. **Firewall**: Check if firewall is blocking connections
4. **OSC Port**: Try different port if 10023 doesn't work
5. **X32 Status**: Ensure mixer is powered on and not in sleep mode

### Actions Not Working
1. **Settings**: Verify all required fields are filled
2. **Network**: Test ping connectivity to X32
3. **Restart**: Try restarting both Stream Deck software and X32
4. **Logs**: Check Stream Deck logs for error messages

## Network Security Considerations

### Firewall Configuration
- **Windows**: Allow Stream Deck through Windows Firewall
- **macOS**: Grant network permissions when prompted
- **Router**: Ensure UDP traffic is allowed between devices

### Network Isolation
- Consider placing X32 and control devices on dedicated VLAN
- Use network switches with proper port security
- Document IP assignments for troubleshooting

## Advanced Configuration

### Multiple X32 Mixers
- Each action can be configured with different IP addresses
- Use descriptive button labels to identify different mixers
- Consider network performance when controlling multiple mixers

### Custom OSC Commands
- Advanced users can modify source code for custom commands
- Refer to X32 OSC documentation for available commands
- Use development installation method for custom builds

## Getting Help

### Documentation
- [Stream Deck SDK Documentation](https://docs.elgato.com/streamdeck/sdk/)
- [X32 OSC Protocol Reference](https://wiki.music-tribe.com/index.php/X32_OSC_Remote_Protocol)

### Community Support
- [GitHub Issues](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/issues)
- [GitHub Discussions](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/discussions)

### Professional Support
For professional installations or custom development, consider reaching out through GitHub or professional audio communities.