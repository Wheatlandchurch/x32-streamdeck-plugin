# Changelog

All notable changes to the X32 Stream Deck Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2025-10-31

### Fixed
- **Scene Recall Command** - Corrected scene recall to use `/load "scene" {number}` command format instead of `/-snap/` commands. X32 properly responds and executes scene changes now
- **Mute Group Configuration** - Fixed property inspector to properly save and load `muteGroup` and `muteGroupName` settings. Mute group actions now configure correctly
- **Channel Fader Initialization** - Fixed duplicate query call in channel fader initialization. Now properly queries both fader level and mute status
- **Status Polling** - Fixed real-time status updates for Channel Mute, DCA Control, and Mute Group actions. Actions now track their instances properly and reflect X32 state changes within 500ms
- **Action Instance Tracking** - Implemented proper instance tracking using Map storage for SingletonAction classes. Button states now update correctly across all action instances

### Changed
- Simplified scene recall confirmation prompts since X32 executes scenes immediately (no preview mode)
- Removed debug logging from production build for cleaner logs

## [2.0.1] - 2025-10-30

### Fixed
- **Critical: Plugin Crash on Startup** - Fixed module type mismatch in `bin/package.json` that caused plugin to crash immediately with exit code 1. Changed from ES module to CommonJS to match build output
- **Critical: Scene Recall Not Working** - Fixed scene recall commands to use correct X32 snapshot protocol (`/-snap/index` + `/-snap/go` instead of `/scene/go/`). Scenes now use 0-based indexing to match X32
- **Critical: Socket Not Receiving** - Added `socket.bind()` to enable receiving UDP responses from X32. This fixed mute groups and all status updates
- **Channel Fader Smoothness** - Implemented 50ms throttling for dial rotation to prevent OSC flooding. UI updates immediately while commands are sent efficiently
- **Connection Test**: Fixed OSC connection test that was timing out. X32 does not respond to `/xremote` command, so connection test now queries a channel parameter to verify connectivity
- **Icon Quality**: Regenerated all icons at proper SDK-specified sizes (72x72/@1x, 144x144/@2x for actions; 256x256/@1x, 512x512/@2x for plugin)
- **Icon Centering**: Fixed centering for plugin icons and mute group icons
- **Marketplace Media**: Added professional marketplace media assets with proper bullet point rendering

### Added
- **Marketplace Assets**: Created 5 professional media assets for Elgato Marketplace submission
  - Hero banner (1920x960)
  - Features overview (1600x900)
  - Stream Deck layout example (1200x768)
  - Channel fader demonstration (1200x1486)
  - Scene recall demonstration (1200x1494)

## [2.0.0] - 2025-10-27

### Added ⭐ Major Update
- **Stream Deck+ Dial Support**: Full optimization for Stream Deck+ rotary encoders
- **Mute Group Control**: New action for controlling X32 mute groups (1-6)
- **Configurable Dial Press Actions**: Three modes for Channel Fader dial press behavior
- **Enhanced Visual Feedback**: Dial indicators and improved status display
- **Professional Category Organization**: Actions now appear under "Behringer X32" category

### Enhanced Channel Fader
- **Stream Deck+ Optimization**: Native dial support with smooth rotation control
- **Configurable Dial Press**: Choose between three press actions:
  - **Mute/Unmute** (default): Instant channel muting
  - **Unity Gain**: Quick 0dB reference setting  
  - **Fine Adjustment**: Precision control mode
- **Dual Step Sizes**: Separate normal and fine adjustment increments
- **Enhanced Feedback**: Shows fader level, mute status, and dial position
- **Real-time Updates**: Monitors both fader and mute status from mixer

### New Mute Group Action
- **Batch Muting**: Control X32 mute groups for multiple channel management
- **Custom Naming**: Configurable display names for each mute group
- **Status Feedback**: Real-time active/inactive status display
- **Professional Workflow**: Perfect for live performance and recording scenarios

### Technical Improvements
- **Enhanced OSC Client**: Added mute group communication support
- **Improved Manifest**: Proper Stream Deck+ controller definitions
- **Updated UI**: New configuration options for dial press behavior
- **Better Documentation**: Comprehensive Stream Deck+ feature guide

### User Experience
- **Category Organization**: All actions now grouped under "Behringer X32"
- **Intuitive Controls**: Logical dial behavior with professional workflow support
- **Visual Clarity**: Enhanced status indicators and feedback
- **Backward Compatibility**: All features work on standard Stream Deck devices

### Configuration Updates
- **Minimum Software Version**: Now requires Stream Deck software v6.6+
- **New Settings**: Dial press action configuration and fine step size control
- **Enhanced Property Inspectors**: Updated UI with new configuration options
- **Improved Documentation**: Updated README, INSTALL, and new STREAMDECK_PLUS guides

### Breaking Changes
- **UUID Updates**: Action UUIDs changed to match new plugin identifier structure
- **Category Change**: Actions moved from "Audio" to "Behringer X32" category
- **Software Requirements**: Stream Deck v6.6+ required for dial features

### Migration Guide
- Existing users should uninstall previous version before installing v2.0.0
- Re-configure actions after installation (UUIDs have changed)
- Stream Deck+ users can now assign Channel Fader to dials for enhanced control

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