import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, DialRotateEvent, TouchTapEvent, DialDownEvent, DialUpEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  channel?: number;
  step?: number; // Step size for fader adjustments (0.01 to 0.1)
  fineStep?: number; // Fine step size when holding dial (0.001 to 0.01)
  dialPressAction?: 'mute' | 'unity' | 'fine'; // What happens when dial is pressed
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.fader" })
export class ChannelFaderAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private currentLevel: number = 0;
  private isDialPressed: boolean = false;
  private channelMuted: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        x32Port: 10023,
        channel: 1,
        step: 0.05,
        fineStep: 0.01,
        dialPressAction: 'mute'
      });
    }

    const currentSettings = await ev.action.getSettings();
    await this.connectToX32(currentSettings);
    await this.updateButtonTitle(ev.action);
    await this.updateDialFeedback(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    if (!this.x32Client || !this.x32Client.isConnected()) {
      await this.connectToX32(settings);
      if (!this.x32Client || !this.x32Client.isConnected()) {
        streamDeck.logger.error("Failed to connect to X32");
        await ev.action.showAlert();
        return;
      }
    }

    if (!settings.channel) {
      streamDeck.logger.error("Channel not configured");
      await ev.action.showAlert();
      return;
    }

    try {
      // On key press, reset fader to unity (0.75 in X32 terms, which is 0dB)
      const unityLevel = 0.75;
      await this.x32Client.setChannelFader(settings.channel, unityLevel);
      this.currentLevel = unityLevel;
      await this.updateButtonTitle(ev.action);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to set fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialRotate(ev: DialRotateEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    if (!this.x32Client || !this.x32Client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    if (!settings.channel) {
      await ev.action.showAlert();
      return;
    }

    try {
      // Use fine step when dial is pressed AND dialPressAction is 'fine'
      const useFineStep = this.isDialPressed && (settings.dialPressAction === 'fine');
      const stepSize = useFineStep ? (settings.fineStep || 0.01) : (settings.step || 0.05);
      const ticks = ev.payload.ticks;
      const newLevel = Math.max(0, Math.min(1, this.currentLevel + (ticks * stepSize)));
      
      await this.x32Client.setChannelFader(settings.channel, newLevel);
      this.currentLevel = newLevel;
      await this.updateButtonTitle(ev.action);
      
      // Update the dial indicator
      await this.updateDialFeedback(ev.action);
    } catch (error) {
      streamDeck.logger.error("Failed to adjust fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onTouchTap(ev: TouchTapEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    if (!this.x32Client || !this.x32Client.isConnected()) {
      return;
    }

    if (!settings.channel) {
      return;
    }

    try {
      // Toggle between current level and unity (0dB)
      const unityLevel = 0.75;
      const newLevel = Math.abs(this.currentLevel - unityLevel) < 0.01 ? 0 : unityLevel;
      
      await this.x32Client.setChannelFader(settings.channel, newLevel);
      this.currentLevel = newLevel;
      await this.updateButtonTitle(ev.action);
      await this.updateDialFeedback(ev.action);
    } catch (error) {
      streamDeck.logger.error("Failed to set fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialDown(ev: DialDownEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    this.isDialPressed = true;
    
    if (!this.x32Client || !this.x32Client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    if (!settings.channel) {
      await ev.action.showAlert();
      return;
    }

    try {
      const dialAction = settings.dialPressAction || 'mute';
      
      switch (dialAction) {
        case 'mute':
          // Toggle mute/unmute
          this.channelMuted = !this.channelMuted;
          await this.x32Client.muteChannel(settings.channel, this.channelMuted);
          await this.updateButtonTitle(ev.action);
          streamDeck.logger.info(`Channel ${settings.channel} ${this.channelMuted ? 'muted' : 'unmuted'}`);
          break;
          
        case 'unity':
          // Set to unity (0dB)
          const unityLevel = 0.75;
          await this.x32Client.setChannelFader(settings.channel, unityLevel);
          this.currentLevel = unityLevel;
          await this.updateButtonTitle(ev.action);
          await this.updateDialFeedback(ev.action);
          streamDeck.logger.info(`Channel ${settings.channel} set to unity (0dB)`);
          break;
          
        case 'fine':
          // Enable fine adjustment mode (handled in onDialRotate)
          streamDeck.logger.info("Fine adjustment mode enabled");
          break;
      }
    } catch (error) {
      streamDeck.logger.error("Failed to execute dial press action:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialUp(ev: DialUpEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    this.isDialPressed = false;
    
    const dialAction = settings.dialPressAction || 'mute';
    if (dialAction === 'fine') {
      streamDeck.logger.info("Fine adjustment mode disabled");
    }
  }

  private async connectToX32(settings: Settings): Promise<void> {
    if (!settings.x32Host || !settings.x32Port) {
      return;
    }

    try {
      this.x32Client = new X32Client({
        host: settings.x32Host,
        port: settings.x32Port
      });

      this.x32Client.on('error', (error) => {
        streamDeck.logger.error("X32 Client error:", error);
      });

      this.x32Client.on('message', (msg) => {
        this.handleX32Message(msg, settings);
      });

      await this.x32Client.connect();
      
      if (settings.channel) {
        this.x32Client.subscribeToChannel(settings.channel);
        // Request initial fader level and mute status
        await this.x32Client.getChannelFaderLevel(settings.channel);
        await this.x32Client.getChannelMuteStatus(settings.channel);
      }
      
      streamDeck.logger.info(`Connected to X32 at ${settings.x32Host}:${settings.x32Port}`);
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
    }
  }

  private handleX32Message(msg: { address: string; args: any[] }, settings: Settings): void {
    if (!settings.channel) return;

    const channelFaderAddress = `/ch/${settings.channel.toString().padStart(2, '0')}/mix/fader`;
    const channelMuteAddress = `/ch/${settings.channel.toString().padStart(2, '0')}/mix/on`;
    
    if (msg.address === channelFaderAddress && msg.args.length > 0) {
      this.currentLevel = parseFloat(msg.args[0]);
      // Update all instances of this action
      this.updateAllButtonTitles();
    } else if (msg.address === channelMuteAddress && msg.args.length > 0) {
      // X32 sends 1 for unmuted, 0 for muted
      this.channelMuted = msg.args[0] === 0;
      // Update all instances of this action
      this.updateAllButtonTitles();
    }
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const dBLevel = this.levelToDb(this.currentLevel);
    const muteStatus = this.channelMuted ? " (MUTED)" : "";
    const title = `Ch${settings.channel || '?'}\\n${dBLevel}dB${muteStatus}`;
    await action.setTitle(title);
  }

  private async updateDialFeedback(action: any): Promise<void> {
    // Set dial feedback to show current fader level (0-100%)
    const percentage = Math.round(this.currentLevel * 100);
    
    // Use setFeedback if available, otherwise setIndicator
    if (typeof action.setFeedback === 'function') {
      await action.setFeedback({
        value: percentage,
        opacity: 100
      });
    } else if (typeof action.setIndicator === 'function') {
      await action.setIndicator(percentage);
    }
  }

  private async updateAllButtonTitles(): Promise<void> {
    // Note: This might need to be updated based on Stream Deck API
    // For now, we'll handle individual instances through events
    const instances = streamDeck.actions.getActionById("com.wheatland-community-church.behringer-x32.fader");
    if (instances && Array.isArray(instances)) {
      for (const instance of instances) {
        await this.updateButtonTitle(instance);
      }
    } else if (instances) {
      // Single instance
      await this.updateButtonTitle(instances);
    }
  }

  private levelToDb(level: number): string {
    if (level === 0) return "-∞";
    
    // X32 fader curve approximation
    let db: number;
    if (level <= 0.75) {
      // Below unity gain
      db = (level / 0.75) * 0 - 60;
    } else {
      // Above unity gain
      db = ((level - 0.75) / 0.25) * 10;
    }
    
    return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
  }
}