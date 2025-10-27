import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  channel?: number;
};

@action({ UUID: "com.wheatlandchurch.x32-mixer.mute" })
export class ChannelMuteAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private channelMuted: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        x32Port: 10023,
        channel: 1
      });
    }

    await this.connectToX32(ev.action.getSettings());
    await this.updateButtonState(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    if (this.x32Client) {
      const settings = ev.payload.settings;
      if (settings.channel) {
        this.x32Client.unsubscribeFromChannel(settings.channel);
      }
    }
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
      // Toggle mute state
      this.channelMuted = !this.channelMuted;
      await this.x32Client.muteChannel(settings.channel, this.channelMuted);
      await this.updateButtonState(ev.action);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to toggle mute:", error);
      await ev.action.showAlert();
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
        // Request initial status
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

    const channelMuteAddress = `/ch/${settings.channel.toString().padStart(2, '0')}/mix/on`;
    
    if (msg.address === channelMuteAddress && msg.args.length > 0) {
      const isOn = msg.args[0] === 1;
      this.channelMuted = !isOn; // X32 uses 1 for on (unmuted), 0 for off (muted)
      
      // Update all instances of this action
      this.updateAllButtonStates();
    }
  }

  private async updateButtonState(action: any): Promise<void> {
    await action.setState(this.channelMuted ? 1 : 0);
  }

  private async updateAllButtonStates(): Promise<void> {
    // This will update all instances of the mute action
    const instances = streamDeck.actions.getActionById("com.wheatlandchurch.x32-mixer.mute");
    if (instances) {
      for (const instance of instances) {
        await this.updateButtonState(instance);
      }
    }
  }
}