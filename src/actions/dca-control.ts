import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  dca?: number;
  dcaName?: string;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.dca" })
export class DCAControlAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private dcaMuted: boolean = false;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        x32Port: 10023,
        dca: 1,
        dcaName: "DCA 1"
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
      if (settings.dca) {
        this.x32Client.unsubscribeFromDCA(settings.dca);
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

    if (!settings.dca) {
      streamDeck.logger.error("DCA not configured");
      await ev.action.showAlert();
      return;
    }

    try {
      // Toggle mute state
      this.dcaMuted = !this.dcaMuted;
      await this.x32Client.muteDCA(settings.dca, this.dcaMuted);
      await this.updateButtonState(ev.action);
      await this.updateButtonTitle(ev.action);
      await ev.action.showOk();
      
      streamDeck.logger.info(`DCA ${settings.dca} ${this.dcaMuted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      streamDeck.logger.error("Failed to toggle DCA mute:", error);
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
      
      if (settings.dca) {
        this.x32Client.subscribeToDCA(settings.dca);
        // Request initial status
        await this.x32Client.getDCAMuteStatus(settings.dca);
      }
      
      streamDeck.logger.info(`Connected to X32 at ${settings.x32Host}:${settings.x32Port}`);
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
    }
  }

  private handleX32Message(msg: { address: string; args: any[] }, settings: Settings): void {
    if (!settings.dca) return;

    const dcaMuteAddress = `/dca/${settings.dca}/on`;
    
    if (msg.address === dcaMuteAddress && msg.args.length > 0) {
      const isOn = msg.args[0] === 1;
      this.dcaMuted = !isOn; // X32 uses 1 for on (unmuted), 0 for off (muted)
      
      // Update all instances of this action
      this.updateAllButtonStates();
    }
  }

  private async updateButtonState(action: any): Promise<void> {
    await action.setState(this.dcaMuted ? 1 : 0);
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const dcaName = settings.dcaName || `DCA ${settings.dca || '?'}`;
    const status = this.dcaMuted ? "MUTED" : "ACTIVE";
    await action.setTitle(`${dcaName}\\n${status}`);
  }

  private async updateAllButtonStates(): Promise<void> {
    const instances = streamDeck.actions.getActionById("com.wheatland-community-church.behringer-x32.dca");
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