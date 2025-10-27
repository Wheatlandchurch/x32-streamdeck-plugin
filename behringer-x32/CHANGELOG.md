# Changelog

All notable changes to the X32 Stream Deck Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-27

### Added
- Initial release of X32 Stream Deck Plugin
- Channel Mute/Unmute action for input channels 1-32
- Channel Fader control with dial rotation and dB display
- Scene Recall action with optional double-tap confirmation
- DCA Control action for DCA groups 1-8
- Real-time feedback system for button states
- Property inspectors for easy configuration
- Connection testing functionality
- Comprehensive error handling and logging
- Network connection management with auto-reconnection
- Visual status indicators and feedback
- Support for Windows and macOS
- Comprehensive documentation and installation guide

### Features
- **OSC Communication**: Robust Open Sound Control client for X32 communication
- **Multi-Action Support**: Four distinct action types for different mixer controls
- **Real-Time Feedback**: Button states automatically reflect mixer status
- **Error Handling**: Comprehensive error handling with user-friendly feedback
- **Network Management**: Automatic connection management and retry logic
- **User Interface**: Intuitive property inspectors with validation
- **Visual Design**: Custom icons and visual states for all actions
- **Documentation**: Complete setup and troubleshooting guides

### Technical Details
- Built with TypeScript and Stream Deck SDK v0.3.3
- Uses node-osc library for OSC communication
- Rollup build system for optimized bundling
- Comprehensive CSS styling for property inspectors
- SVG-based icons for scalability
- Modular architecture for maintainability

### Supported Actions
1. **Channel Mute** (`com.wheatlandchurch.x32-mixer.mute`)
   - Toggle mute state for channels 1-32
   - Real-time feedback with visual indicators
   
2. **Channel Fader** (`com.wheatlandchurch.x32-mixer.fader`)
   - Control fader levels with dial rotation
   - Display current level in dB
   - Key press sets unity gain (0dB)
   
3. **Scene Recall** (`com.wheatlandchurch.x32-mixer.scene`)
   - Load and recall scenes 1-100
   - Optional confirmation mode (double-tap)
   - Custom scene naming
   
4. **DCA Control** (`com.wheatlandchurch.x32-mixer.dca`)
   - Control DCA groups 1-8
   - Mute/unmute with visual feedback
   - Custom DCA naming

### Known Limitations
- Requires network connectivity between Stream Deck computer and X32 mixer
- OSC must be enabled on X32 (enabled by default)
- Limited to basic mixer controls (mute, fader, scene, DCA)
- No support for auxiliary sends or matrix outputs in v1.0

### System Requirements
- Stream Deck software v6.4 or higher
- Windows 10+ or macOS 10.15+
- Network connectivity to Behringer X32 mixer
- Node.js v20+ (for development only)

---

## Future Releases

### Planned for v1.1.0
- Auxiliary send controls
- Bus and matrix output controls
- Custom fader curves
- Scene safes and recalls with fade times
- Extended channel strip controls (EQ, compressor)

### Planned for v1.2.0
- X32 Rack and M32 support
- Multiple mixer support in single plugin
- Preset management for common configurations
- Advanced scene management features

### Under Consideration
- MIDI integration
- Time-based automation
- Custom OSC command support
- Plugin presets and templates
- Advanced visual customization options

---

## Development Notes

### Build System
- TypeScript compilation with strict type checking
- Rollup bundling for optimized output
- Automatic plugin installation during development
- Hot reload support for rapid development

### Testing
- Manual testing with X32 mixer hardware
- Network connectivity testing
- Cross-platform compatibility verification
- Property inspector functionality testing

### Documentation
- Comprehensive README with setup instructions
- Detailed installation guide
- Troubleshooting section with common issues
- OSC command reference for developers

---

## Contributing

We welcome contributions! Please see our contributing guidelines and feel free to submit issues or pull requests.

### Reporting Issues
When reporting issues, please include:
- Plugin version
- Stream Deck software version
- Operating system
- X32 mixer model and firmware version
- Network configuration details
- Steps to reproduce the issue

### Feature Requests
Feature requests are welcome! Please provide:
- Clear description of the desired functionality
- Use case or scenario where it would be helpful
- Any relevant X32 OSC commands or documentation

---

*For more information, visit the [project repository](https://github.com/Wheatlandchurch/x32-streamdeck-plugin)*