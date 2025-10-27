# Stream Deck+ Enhanced Features

This document covers the enhanced features available when using the X32 Stream Deck Plugin with Stream Deck+ devices.

## Overview

The X32 Stream Deck Plugin is optimized for Stream Deck+ devices with rotary encoders (dials), providing professional-grade mixing control with enhanced precision and workflow optimization.

## Enhanced Actions

### Channel Fader (Dial Optimized)

The Channel Fader action is specifically enhanced for Stream Deck+ dials, offering three distinct control modes to match different workflow requirements.

#### Dial Controls
- **Rotate**: Smooth, continuous fader adjustment with real-time feedback
- **Press**: Configurable action (see modes below)
- **Touch**: Toggle between current level and unity (0dB)

#### Visual Feedback
- **Dial Indicator**: Shows current fader position (0-100%)
- **Button Title**: Displays channel number, dB level, and mute status
- **Real-time Updates**: Automatically reflects changes made on mixer

#### Configurable Dial Press Modes

##### 1. Mute/Unmute (Default - Recommended)
**Best for**: Live performance, quick sound control

- **Action**: Press dial to instantly mute/unmute the channel
- **Feedback**: Title shows "(MUTED)" when channel is muted
- **Workflow**: Adjust levels with rotation, quick mute with press
- **Use Case**: Perfect for live situations where you need immediate mute access

```
Example: "Ch05\n-12dB (MUTED)"
```

##### 2. Unity Gain
**Best for**: Recording, sound check, mixing

- **Action**: Press dial to set fader to unity gain (0dB)
- **Feedback**: Fader jumps to 0dB position, dial indicator updates
- **Workflow**: Quick reference level setting during setup
- **Use Case**: Ideal for establishing consistent reference levels

```
Example: "Ch05\n0dB" (after press)
```

##### 3. Fine Adjustment
**Best for**: Precise mixing, critical adjustments

- **Action**: Hold dial pressed while rotating for ultra-precise control
- **Feedback**: Uses smaller step increments while pressed
- **Workflow**: Normal rotation for coarse, press+rotate for fine
- **Use Case**: Perfect for detailed mix adjustments and automation

```
Normal: 5% steps
Fine: 1% steps (or custom configured)
```

## Configuration Options

### Step Size Settings

#### Normal Step Size
- **Range**: 1% - 10%
- **Default**: 5%
- **Purpose**: Regular dial rotation increment
- **Recommendation**: 5% for general use, 2.5% for precise work

#### Fine Step Size
- **Range**: 0.1% - 2.5% 
- **Default**: 1%
- **Purpose**: Precision adjustment when dial is pressed (fine mode only)
- **Recommendation**: 1% for detailed mixing, 0.5% for critical work

### Channel Configuration
- **Channel Selection**: Any X32 input channel (1-32)
- **Network Settings**: X32 IP address and OSC port
- **Custom Labels**: Automatic channel number display

## Professional Workflows

### Live Performance Setup
```
Dial Press Mode: Mute/Unmute
Normal Step: 5%
Fine Step: 1%

Workflow:
- Rotate for level adjustments
- Press for instant mute/unmute
- Touch for unity reference
```

### Recording Session Setup
```
Dial Press Mode: Unity Gain
Normal Step: 2.5%
Fine Step: 0.5%

Workflow:
- Press for 0dB reference setting
- Rotate for precise gain staging
- Touch for level comparison
```

### Precision Mixing Setup
```
Dial Press Mode: Fine Adjustment
Normal Step: 5%
Fine Step: 0.5%

Workflow:
- Rotate for coarse adjustments
- Press+Rotate for fine control
- Touch for reference comparison
```

## Technical Details

### Dial Feedback Resolution
- **Indicator Range**: 0-100% (matches fader position)
- **Update Rate**: Real-time with mixer changes
- **Precision**: 1% visual resolution

### OSC Communication
- **Fader Range**: 0.0 - 1.0 (X32 native)
- **Unity Position**: 0.75 (0dB equivalent)
- **Mute Commands**: `/ch/XX/mix/on` (1=unmuted, 0=muted)
- **Fader Commands**: `/ch/XX/mix/fader` (0.0-1.0 range)

### Backward Compatibility
- All dial features are automatically available on Stream Deck+ hardware
- Actions function normally on standard Stream Deck devices
- No special installation required for enhanced features

## Best Practices

### Dial Assignment Strategy
1. **Primary Channels**: Assign most-used channels to dials
2. **Workflow Grouping**: Group related channels on adjacent dials
3. **Mode Consistency**: Use same dial press mode across similar channels
4. **Label Clearly**: Use custom names for easy identification

### Performance Optimization
1. **Network Stability**: Ensure robust network connection to X32
2. **Latency Monitoring**: Test dial response time during setup
3. **Backup Controls**: Keep critical controls on both dials and buttons
4. **Regular Testing**: Verify dial functionality before performances

### Troubleshooting Dial Issues

#### Dial Not Responding
1. Check Stream Deck+ firmware version
2. Verify Stream Deck software v6.6+
3. Restart Stream Deck application
4. Test with other dial actions

#### Inconsistent Feedback
1. Check network latency to X32
2. Verify OSC port configuration
3. Test with different step sizes
4. Monitor X32 CPU usage

#### Configuration Not Saving
1. Restart Stream Deck software
2. Re-configure action settings
3. Check file permissions
4. Clear Stream Deck cache

## Future Enhancements

The plugin continues to evolve with Stream Deck+ capabilities:

- **Multi-touch gestures** for complex operations
- **LED ring indicators** for additional visual feedback  
- **Haptic feedback** integration for tactile response
- **Custom dial layouts** for specialized workflows

## Support and Resources

- **Documentation**: [Main README](README.md)
- **Installation Guide**: [INSTALL.md](INSTALL.md)
- **Issues**: [GitHub Issues](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Wheatlandchurch/x32-streamdeck-plugin/discussions)

---

*Stream Deck+ features require Stream Deck+ hardware and Stream Deck software v6.6 or higher.*