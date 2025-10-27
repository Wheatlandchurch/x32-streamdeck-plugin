import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  muteGroup?: number; // Mute group number (1-6)
  muteGroupName?: string; // Display name for the mute group
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.mutegroup" })
export class MuteGroupAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private muteGroupActive: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        x32Port: 10023,
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
    if (this.x32Client) {
      const settings = ev.payload.settings;
      if (settings.muteGroup) {
        this.x32Client.unsubscribeFromMuteGroup(settings.muteGroup);
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
    // This will update all instances of the mute group action
    const instances = streamDeck.actions.getActionById("com.wheatland-community-church.behringer-x32.mutegroup");
    if (instances && Array.isArray(instances)) {
      for (const instance of instances) {
        await this.updateButtonState(instance);
        await this.updateButtonTitle(instance);
      }
    } else if (instances) {
      // Single instance
      await this.updateButtonState(instances);
      await this.updateButtonTitle(instances);
    }
  }
}