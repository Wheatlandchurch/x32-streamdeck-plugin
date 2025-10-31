import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  channel?: number;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.mute" })
export class ChannelMuteAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private channelMuted: boolean = false;
  private actionInstances: Map<string, any> = new Map(); // Track action instances by context

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Store this action instance
    this.actionInstances.set(ev.action.id, ev.action);
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        channel: 1
      });
    }

    const currentSettings = await ev.action.getSettings();
    await this.connectToX32(currentSettings);
    await this.updateButtonState(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    // Remove this action instance
    this.actionInstances.delete(ev.action.id);
    
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

  override async onSendToPlugin(ev: SendToPluginEvent<any, Settings>): Promise<void> {
    const payload = ev.payload as any;
    
    // Handle connection test request from property inspector
    if (payload.action === 'testConnection') {
      streamDeck.logger.info(`Testing connection to ${payload.host}:10023`);
      
      try {
        const testClient = new X32Client({
          host: payload.host,
          port: 10023
        });

        await testClient.connect();
        
        // Send success message back to property inspector
        streamDeck.ui.current?.sendToPropertyInspector({
          event: 'connectionTestResult',
          success: true,
          message: `Successfully connected to X32 at ${payload.host}:10023`
        });
        
        streamDeck.logger.info("Connection test successful");
        
        // Clean up test client
        testClient.disconnect();
      } catch (error) {
        // Send error message back to property inspector
        streamDeck.ui.current?.sendToPropertyInspector({
          event: 'connectionTestResult',
          success: false,
          message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        
        streamDeck.logger.error("Connection test failed:", error);
      }
    }
  }

  private async connectToX32(settings: Settings): Promise<void> {
    if (!settings.x32Host) {
      return;
    }

    try {
      this.x32Client = new X32Client({
        host: settings.x32Host,
        port: 10023
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
      
      streamDeck.logger.info(`Connected to X32 at ${settings.x32Host}:10023`);
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
    // Update all tracked instances
    for (const [id, action] of this.actionInstances) {
      await this.updateButtonState(action);
    }
  }
}