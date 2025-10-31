import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  muteGroup?: number; // Mute group number (1-6)
  muteGroupName?: string; // Display name for the mute group
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.mutegroup" })
export class MuteGroupAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private muteGroupActive: boolean = false;
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
        muteGroup: 1,
        muteGroupName: "Mute Group 1"
      });
    }

    const currentSettings = await ev.action.getSettings();
    await this.connectToX32(currentSettings);
    await this.updateButtonState(ev.action);
    await this.updateButtonTitle(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    // Remove this action instance
    this.actionInstances.delete(ev.action.id);
    
    if (this.x32Client) {
      const settings = ev.payload.settings;
      if (settings.muteGroup) {
        this.x32Client.unsubscribeFromMuteGroup(settings.muteGroup);
      }
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

    if (!settings.muteGroup) {
      streamDeck.logger.error("Mute group not configured");
      await ev.action.showAlert();
      return;
    }

    try {
      // Toggle mute group state
      this.muteGroupActive = !this.muteGroupActive;
      await this.x32Client.setMuteGroup(settings.muteGroup, this.muteGroupActive);
      await this.updateButtonState(ev.action);
      await this.updateButtonTitle(ev.action);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to toggle mute group:", error);
      await ev.action.showAlert();
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
      
      if (settings.muteGroup) {
        this.x32Client.subscribeToMuteGroup(settings.muteGroup);
        await this.x32Client.getMuteGroupState(settings.muteGroup);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
    }
  }

  private handleX32Message(msg: any, settings: Settings): void {
    const { address, args } = msg;
    
    if (settings.muteGroup && address === `/config/mute/${settings.muteGroup}`) {
      if (args && args.length > 0) {
        const newState = args[0] === 1;
        if (newState !== this.muteGroupActive) {
          this.muteGroupActive = newState;
          this.updateAllButtonStates();
        }
      }
    }
  }

  private async updateButtonState(action: any): Promise<void> {
    await action.setState(this.muteGroupActive ? 1 : 0);
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const groupName = settings.muteGroupName || `Mute Group ${settings.muteGroup || '?'}`;
    const status = this.muteGroupActive ? "ACTIVE" : "INACTIVE";
    await action.setTitle(`${groupName}\\n${status}`);
  }

  private async updateAllButtonStates(): Promise<void> {
    for (const [id, action] of this.actionInstances) {
      await this.updateButtonState(action);
      await this.updateButtonTitle(action);
    }
  }
}