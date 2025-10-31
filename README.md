# X32 Stream Deck Plugin

A comprehensive Stream Deck plugin for controlling Behringer X32 digital mixers through OSC (Open Sound Control) protocol. This plugin provides extensive control over channel muting, fader levels, DCA groups, mute groups, and scene recall directly from your Stream Deck, with enhanced support for Stream Deck+ dials.

## 🎛️ Features

- **Channel Mute/Unmute**: Toggle mute status for any of the 32 input channels
- **Enhanced Channel Fader Control**: 
  - Precise fader level control optimized for Stream Deck+ dials
  - Configurable dial press actions (mute/unmute, unity gain, fine adjustment)
  - Visual feedback with current level and mute status
  - Fine adjustment mode for precise control
- **Scene Recall**: Load and recall mixer scenes (1-100) with optional confirmation
- **DCA Control**: Mute/unmute Digital Control Assignment groups (1-8)
- **Mute Group Control**: Toggle X32 mute groups (1-6) for batch channel muting
- **Stream Deck+ Dial Support**: Optimized experience for Stream Deck+ devices with rotary encoders
- **Real-time Feedback**: Button states and dial indicators update automatically
- **Network Connection Management**: Automatic reconnection and error handling
- **Professional Organization**: Actions grouped under "Behringer X32" category

## 📋 Requirements

- **Hardware**: 
  - Stream Deck device (any model)
  - Stream Deck+ recommended for enhanced dial functionality
- **Software**: 
  - Stream Deck software v6.6 or higher (v6.6+ required for dial support)
  - Node.js v20 or higher (for development)
- **Mixer**: Behringer X32 digital mixer with network connectivity
- **Network**: Both Stream Deck computer and X32 mixer on the same network

## 🚀 Quick Start

### 1. X32 Mixer Setup

1. Connect your X32 mixer to your network via Ethernet
2. Configure the mixer's network settings:
   - Press **SETUP** button on the X32
   - Navigate to **Network** tab
   - Set a static IP address (e.g., `192.168.1.105`)
   - Note the IP address for plugin configuration
3. OSC will now be enabled on port 10023 (default)

### 2. Plugin Installation

1. Build the plugin from source (see [Development Setup](#-development-setup) below)
2. Double-click the generated `.streamDeckPlugin` file to install
3. The plugin will appear in the Stream Deck actions list under "Behringer X32" category

### 3. Basic Configuration

1. Drag any X32 action to a Stream Deck button or dial
2. In the property inspector, configure:
   - **X32 IP Address**: Your mixer's IP address (e.g., `192.168.1.100`)
   - **X32 Port**: Usually `10023` (default OSC port)
   - **Action-specific settings**: Channel number, scene number, etc.
3. Click "Test X32 Connection" to verify connectivity
4. The button/dial is now ready to use!

## 🎯 Available Actions

### Channel Mute
- **Function**: Toggles mute status for input channels 1-32
- **Configuration**: 
  - Channel number (1-32)
  - X32 connection settings
- **Usage**: Press to toggle mute state
- **Feedback**: Button shows muted (red) or unmuted (green) state

### Channel Fader ⭐ *Enhanced for Stream Deck+*
- **Function**: Precision fader control with advanced dial support
- **Configuration**:
  - Channel number (1-32)
  - Step size for normal adjustments (1%-10%)
  - Fine step size for precision control (0.1%-2.5%)
  - **Configurable dial press action**:
    - **Mute/Unmute** (default): Press dial to toggle channel mute
    - **Unity Gain**: Press dial to set fader to 0dB
    - **Fine Adjustment**: Hold dial for precision control
  - X32 connection settings

#### Stream Deck+ Dial Controls:
- **Rotate**: Adjust fader level with visual feedback
- **Press**: Configurable action (mute/unmute by default)
- **Touch**: Toggle between current level and unity (0dB)

#### Regular Button Controls:
- **Key Press**: Set fader to unity (0dB)

- **Feedback**: 
  - Shows current level in dB with mute status
  - Dial indicator displays fader position (0-100%)
  - Real-time updates from mixer changes

### Scene Recall
- **Function**: Loads and recalls mixer scenes
- **Configuration**:
  - Scene number (1-100)
  - Custom scene name
  - Confirmation mode (double-tap to recall)
  - X32 connection settings
- **Usage**: 
  - Single tap: Load scene (preview)
  - Double tap: Recall scene (if confirmation enabled)
- **Feedback**: Shows scene status during recall

### DCA Control
- **Function**: Controls Digital Control Assignment groups
- **Configuration**:
  - DCA group (1-8)
  - Custom DCA name
  - X32 connection settings
- **Usage**: Press to toggle DCA mute state
- **Feedback**: Shows DCA muted/active status with custom name

### Mute Group Control ⭐ *New*
- **Function**: Controls X32 mute groups for batch channel muting
- **Configuration**:
  - Mute group (1-6)
  - Custom display name
  - X32 connection settings
- **Usage**: Press to toggle mute group active/inactive state
- **Feedback**: Shows group status (ACTIVE/INACTIVE) with custom name
- **Use Cases**: 
  - Mute multiple channels simultaneously
  - Create custom groupings (e.g., "Drums", "Vocals", "Instruments")
  - Quick sound control during performances

## 🛠️ Development Setup

### Prerequisites
- Node.js v20+
- npm
- Stream Deck CLI (`npm install -g @elgato/cli`)

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/Wheatlandchurch/x32-streamdeck-plugin.git
   cd x32-streamdeck-plugin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and watch for changes:
   ```bash
   npm run watch
   ```

4. The plugin will automatically install and restart in Stream Deck

### Project Structure
```
├── src/
│   ├── actions/           # Stream Deck action implementations
│   │   ├── channel-fader.ts    # Enhanced fader with dial support
│   │   ├── channel-mute.ts     # Channel mute control
│   │   ├── scene-recall.ts     # Scene management
│   │   ├── dca-control.ts      # DCA group control
│   │   └── mute-group.ts       # Mute group control (new)
│   ├── x32-client.ts      # OSC communication client
│   ├── utils.ts           # Error handling and utilities
│   └── plugin.ts          # Main plugin entry point
├── com.wheatland-community-church.behringer-x32.sdPlugin/
│   ├── ui/                # Property inspector HTML files
│   │   ├── channel-fader.html   # Enhanced with dial settings
│   │   ├── channel-mute.html
│   │   ├── scene-recall.html
│   │   ├── dca-control.html
│   │   └── mute-group.html      # New configuration UI
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   ├── imgs/              # Action and plugin icons
│   └── manifest.json      # Plugin manifest with dial support
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

## 🔧 Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to X32" error
- **Solution**: 
  1. Verify X32 IP address is correct
  2. Ensure both devices are on the same network
  3. Check if X32 is powered on and network cable is connected
  4. Try pinging the X32 from your computer
  5. Verify OSC port (usually 10023)

**Problem**: Button states not updating
- **Solution**:
  1. Check network stability
  2. Restart the plugin (remove and re-add actions)
  3. Verify X32 is not in sleep mode

### Configuration Issues

**Problem**: Invalid channel/scene numbers
- **Solution**: Ensure values are within valid ranges:
  - Channels: 1-32
  - Scenes: 1-100
  - DCAs: 1-8

**Problem**: Property inspector not loading
- **Solution**:
  1. Restart Stream Deck software
  2. Reinstall the plugin
  3. Check browser console for JavaScript errors

### Performance Issues

**Problem**: Slow response times
- **Solution**:
  1. Check network latency between computer and X32
  2. Reduce polling frequency if needed
  3. Ensure X32 is not overloaded with other OSC clients

## 📚 OSC Commands Reference

The plugin uses these primary OSC addresses:

### Channel Control
- **Channel Mute**: `/ch/01/mix/on` (where 01 is channel number, padded)
- **Channel Fader**: `/ch/01/mix/fader` (0.0 to 1.0 range)

### DCA Control  
- **DCA Mute**: `/dca/1/on` (where 1 is DCA number)
- **DCA Fader**: `/dca/1/fader` (0.0 to 1.0 range)

### Scene Management
- **Scene Load**: `/scene/load/1` (where 1 is scene number)
- **Scene Recall**: `/scene/go/1` (activates the loaded scene)

### Mute Groups ⭐ *New*
- **Mute Group Control**: `/config/mute/1` (where 1 is mute group 1-6)
  - Value: 1 = active, 0 = inactive

### Data Ranges
- **Fader Levels**: 0.0 (muted) to 1.0 (full), 0.75 = unity (0dB)
- **Channel Numbers**: 1-32 (sent as zero-padded strings: "01", "02", etc.)
- **Scene Numbers**: 1-100
- **DCA Numbers**: 1-8
- **Mute Groups**: 1-6

## ⚡ Stream Deck+ Enhanced Features

This plugin is optimized for Stream Deck+ devices with rotary encoders (dials). The enhanced features include:

### Enhanced Channel Fader
- **Precision Control**: Smooth, continuous fader adjustment using the dial
- **Visual Feedback**: Real-time dial indicator showing fader position (0-100%)
- **Configurable Actions**: Three dial press modes to suit your workflow
- **Dual Step Sizes**: Normal and fine adjustment increments
- **Integrated Mute**: Quick access to channel mute without separate button

### Dial Press Modes
1. **Mute/Unmute** (Default): Quick channel muting during performances
2. **Unity Gain**: Instant reset to 0dB reference level  
3. **Fine Adjustment**: Hold for precision control during sound checks

### Usage Scenarios
- **Live Performance**: Quick mute access with precision level control
- **Recording**: Fine gain adjustments during takes
- **Sound Check**: Rapid level setting with unity reference
- **Mixing**: Smooth fader rides with visual feedback

### Backward Compatibility
All actions work perfectly on standard Stream Deck devices - the enhanced dial features are automatically available when using Stream Deck+ hardware.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/) for the comprehensive development framework
- [Behringer X32](https://www.behringer.com/product.html?modelCode=P0ASF) for OSC protocol documentation
- [node-osc](https://github.com/MylesBorins/node-osc) for OSC communication
- Community contributors and testers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/discussions)
- **Documentation**: [Stream Deck SDK Docs](https://docs.elgato.com/streamdeck/sdk/)
- **Stream Deck+ Guide**: [Enhanced Features Documentation](STREAMDECK_PLUS.md)

## 📚 Additional Documentation

- **[Installation Guide](INSTALL.md)**: Complete setup instructions
- **[Stream Deck+ Features](STREAMDECK_PLUS.md)**: Enhanced dial functionality guide  
- **[Changelog](CHANGELOG.md)**: Version history and updates
- **[Marketplace Media](marketplace-media/README.md)**: Professional product images and assets
- **[Resubmission Checklist](RESUBMISSION_CHECKLIST.md)**: Elgato Marketplace submission guide

## 📸 Screenshots

Professional marketplace media assets are available in the `marketplace-media/` folder, including:
- Hero banner showcasing plugin features
- Feature overview with key capabilities
- Stream Deck integration examples
- Channel fader and scene recall demonstrations

---

**Note**: This plugin is not officially affiliated with Behringer or Elgato. X32 is a trademark of Behringer. Stream Deck is a trademark of Elgato.
