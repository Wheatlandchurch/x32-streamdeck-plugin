# X32 Stream Deck Plugin

A comprehensive Stream Deck plugin for controlling Behringer X32 digital mixers through OSC (Open Sound Control) protocol. This plugin allows you to control channel muting, fader levels, DCA groups, and scene recall directly from your Stream Deck.

## 🎛️ Features

- **Channel Mute/Unmute**: Toggle mute status for any of the 32 input channels
- **Channel Fader Control**: Adjust channel levels with dial rotation and visual feedback
- **Scene Recall**: Load and recall mixer scenes (1-100) with optional confirmation
- **DCA Control**: Mute/unmute Digital Control Assignment groups (1-8)
- **Real-time Feedback**: Button states update automatically to reflect mixer status
- **Network Connection Management**: Automatic reconnection and error handling
- **Visual Status Indicators**: Clear button states and level displays

## 📋 Requirements

- **Hardware**: Stream Deck device (any model)
- **Software**: 
  - Stream Deck software v6.4 or higher
  - Node.js v20 or higher (for development)
- **Mixer**: Behringer X32 digital mixer with network connectivity
- **Network**: Both Stream Deck computer and X32 mixer on the same network

## 🚀 Quick Start

### 1. X32 Mixer Setup

1. Connect your X32 mixer to your network via Ethernet
2. Configure the mixer's IP address:
   - Go to **Setup** → **Config** → **Network**
   - Set a static IP address (e.g., `192.168.1.100`)
   - Note the IP address for plugin configuration
3. Ensure OSC is enabled (usually enabled by default on port 10023)

### 2. Plugin Installation

1. Download the latest release from the [releases page](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/releases)
2. Double-click the `.streamDeckPlugin` file to install
3. The plugin will appear in the Stream Deck actions list under "Audio" category

### 3. Basic Configuration

1. Drag any X32 action to a Stream Deck button
2. In the property inspector, configure:
   - **X32 IP Address**: Your mixer's IP address (e.g., `192.168.1.100`)
   - **X32 Port**: Usually `10023` (default OSC port)
   - **Action-specific settings**: Channel number, scene number, etc.
3. Click "Test X32 Connection" to verify connectivity
4. The button is now ready to use!

## 🎯 Available Actions

### Channel Mute
- **Function**: Toggles mute status for input channels 1-32
- **Configuration**: 
  - Channel number (1-32)
  - X32 connection settings
- **Usage**: Press to toggle mute state
- **Feedback**: Button shows muted (red) or unmuted (green) state

### Channel Fader
- **Function**: Controls channel fader levels with visual dB display
- **Configuration**:
  - Channel number (1-32)
  - Step size for adjustments (1%-10%)
  - X32 connection settings
- **Usage**: 
  - Press: Set to unity (0dB)
  - Dial rotate: Adjust level
  - Touch tap: Refresh current level
- **Feedback**: Shows current level in dB

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
- **Feedback**: Shows DCA muted/active status

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
│   ├── x32-client.ts      # OSC communication client
│   ├── utils.ts           # Error handling and utilities
│   └── plugin.ts          # Main plugin entry point
├── com.wheatlandchurch.x32-mixer.sdPlugin/
│   ├── ui/                # Property inspector HTML files
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   ├── imgs/              # Action and plugin icons
│   └── manifest.json      # Plugin manifest
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

- **Channel Mute**: `/ch/01/mix/on` (where 01 is channel number)
- **Channel Fader**: `/ch/01/mix/fader`
- **DCA Mute**: `/dca/1/on` (where 1 is DCA number)
- **DCA Fader**: `/dca/1/fader`
- **Scene Load**: `/scene/load/1` (where 1 is scene number)
- **Scene Recall**: `/scene/go/1`

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

---

**Note**: This plugin is not officially affiliated with Behringer or Elgato. X32 is a trademark of Behringer. Stream Deck is a trademark of Elgato.
