# Marketplace Media Assets

This folder contains professionally designed media assets for the Elgato Marketplace product listing.

## Files Overview

### 01-hero-banner.png (1920x960)
**Primary Product Image**
- Large hero banner showcasing the plugin
- Features plugin icon, title, and key benefits
- Dark, professional design
- Use as the main product page header image

### 02-features-overview.png (1600x900)
**Feature Showcase**
- Grid layout highlighting 4 main features:
  - Channel Control (32 channels with fader + mute)
  - Scene Recall (100 scenes with custom names)
  - DCA Groups (8 DCA groups for master control)
  - Mute Groups (6 mute groups for quick control)
- Additional benefits listed below
- Perfect for gallery or feature section

### 03-streamdeck-layout.png (1200x768)
**Stream Deck Integration**
- Shows actual Stream Deck layout with plugin actions
- Demonstrates how actions are organized
- Annotated with title and description
- Real-world usage example

### 04-channel-fader.png (1200x1486)
**Precise Fader Control**
- Highlights Stream Deck+ dial support
- Shows real-time dB display
- Property inspector configuration visible
- Demonstrates touch controls and precision

### 05-scene-recall.png (1200x1494)
**Quick Scene Recall**
- Shows scene selection interface
- Demonstrates custom scene naming
- Configuration options visible
- Clear example of scene management

## Usage Instructions

### For Elgato Marketplace Submission:

1. **Main Product Image**: Upload `01-hero-banner.png`
   - This will be the primary image visitors see

2. **Gallery Images**: Upload in this order:
   - `02-features-overview.png` - Overview of capabilities
   - `03-streamdeck-layout.png` - Real-world integration
   - `04-channel-fader.png` - Key feature highlight
   - `05-scene-recall.png` - Additional feature

3. **Product Description**: Pair images with detailed captions explaining:
   - What the feature does
   - How users benefit
   - Technical specifications (channels, scenes, groups)
   - Compatibility (Stream Deck models, X32 mixer models)

## Technical Specifications

All images are:
- PNG format with transparency support
- Optimized for web display
- High-resolution for sharp display on all devices
- Dark-themed to match Elgato's brand aesthetic

## Source Files

These media assets were generated from:
- Plugin icon: `com.wheatland-community-church.behringer-x32.sdPlugin/imgs/plugin/icon@2x.png`
- Action icons: `com.wheatland-community-church.behringer-x32.sdPlugin/imgs/actions/*/icon@2x.png`
- Screenshots: `com.wheatland-community-church.behringer-x32.sdPlugin/imgs/screenshots/*.png`

## Regenerating Assets

To regenerate these assets, run:
```powershell
powershell -ExecutionPolicy Bypass -File create-marketplace-media.ps1
```

This will recreate all media files with the latest screenshots and branding.

## Notes

- Images are designed to meet Elgato Marketplace guidelines
- Dark theme matches Stream Deck brand aesthetic
- All assets maintain professional quality standards
- Screenshots show real functionality, not mockups
