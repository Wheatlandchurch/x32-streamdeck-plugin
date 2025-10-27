import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, DialRotateEvent, TouchTapEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  channel?: number;
  step?: number; // Step size for fader adjustments (0.01 to 0.1)
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.fader" })
export class ChannelFaderAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private currentLevel: number = 0;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        x32Port: 10023,
        channel: 1,
        step: 0.05
      });
    }

    const currentSettings = await ev.action.getSettings();
    await this.connectToX32(currentSettings);
    await this.updateButtonTitle(ev.action);
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
      const step = settings.step || 0.05;
      const ticks = ev.payload.ticks;
      const newLevel = Math.max(0, Math.min(1, this.currentLevel + (ticks * step)));
      
      await this.x32Client.setChannelFader(settings.channel, newLevel);
      this.currentLevel = newLevel;
      await this.updateButtonTitle(ev.action);
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
      // Request current fader level
      await this.x32Client.getChannelFaderLevel(settings.channel);
    } catch (error) {
      streamDeck.logger.error("Failed to get fader level:", error);
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
        // Request initial fader level
        await this.x32Client.getChannelFaderLevel(settings.channel);
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
    
    if (msg.address === channelFaderAddress && msg.args.length > 0) {
      this.currentLevel = parseFloat(msg.args[0]);
      
      // Update all instances of this action
      this.updateAllButtonTitles();
    }
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const dBLevel = this.levelToDb(this.currentLevel);
    const title = `Ch${settings.channel || '?'}\\n${dBLevel}dB`;
    await action.setTitle(title);
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