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
  private connectedHost: string | null = null;

  // Keep per-context state (since this is a SingletonAction, multiple keys can exist simultaneously)
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      muteGroup: number;
    }
  > = new Map();

  // Track the current state per mute group so we don't mix state between buttons
  private muteGroupStates: Map<number, { active: boolean }> = new Map();
  private subscribedGroups: Set<number> = new Set();

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;

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
    const host = currentSettings.x32Host!;
    const muteGroup = currentSettings.muteGroup ?? 1;

    // Track this action instance for updates
    const contextId = ev.action.id;
    this.contextStates.set(contextId, {
      action: ev.action,
      host,
      muteGroup
    });

    await this.ensureConnected(host);
    await this.subscribeToMuteGroup(muteGroup);
    await this.requestMuteGroupState(muteGroup);
    await this.updateButtonForContext(contextId);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);
    this.contextStates.delete(contextId);

    if (!contextState) {
      return;
    }

    const { muteGroup } = contextState;

    // If no remaining context uses this mute group, unsubscribe and clear cached state
    if (![...this.contextStates.values()].some(cs => cs.muteGroup === muteGroup)) {
      this.subscribedGroups.delete(muteGroup);
      this.x32Client?.unsubscribeFromMuteGroup(muteGroup);
      this.muteGroupStates.delete(muteGroup);
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
        streamDeck.ui.sendToPropertyInspector({
          event: 'connectionTestResult',
          success: true,
          message: `Successfully connected to X32 at ${payload.host}:10023`
        });
        
        streamDeck.logger.info("Connection test successful");
        
        // Clean up test client
        testClient.disconnect();
      } catch (error) {
        // Send error message back to property inspector
        streamDeck.ui.sendToPropertyInspector({
          event: 'connectionTestResult',
          success: false,
          message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        
        streamDeck.logger.error("Connection test failed:", error);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for mute group action");
      await ev.action.showAlert();
      return;
    }

    const { host, muteGroup } = contextState;

    await this.ensureConnected(host);
    if (!this.x32Client || !this.x32Client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    const state = this.getMuteGroupState(muteGroup);
    state.active = !state.active;

    try {
      await this.x32Client.setMuteGroup(muteGroup, state.active);
      await this.updateButtonForContext(contextId);
      await ev.action.showOk();

      streamDeck.logger.info(`Mute Group ${muteGroup} ${state.active ? 'active' : 'inactive'}`);
    } catch (error) {
      streamDeck.logger.error("Failed to toggle mute group:", error);
      await ev.action.showAlert();
    }
  }

  private async ensureConnected(host: string): Promise<void> {
    if (this.x32Client && this.connectedHost === host && this.x32Client.isConnected()) {
      return;
    }

    if (this.x32Client) {
      this.x32Client.disconnect();
      this.x32Client = null;
      this.connectedHost = null;
    }

    try {
      this.x32Client = new X32Client({
        host,
        port: 10023
      });

      this.connectedHost = host;

      this.x32Client.on('error', (error) => {
        streamDeck.logger.error("X32 Client error:", error);
      });

      this.x32Client.on('message', (msg) => {
        this.handleX32Message(msg);
      });

      await this.x32Client.connect();
      streamDeck.logger.info(`Connected to X32 at ${host}:10023`);

      // Re-subscribe to any mute groups we were previously tracking
      for (const group of this.subscribedGroups) {
        await this.x32Client.subscribeToMuteGroup(group);
        await this.requestMuteGroupState(group);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
      this.connectedHost = null;
    }
  }

  private handleX32Message(msg: any): void {
    const { address, args } = msg;
    const match = address.match(/^\/config\/mute\/(\d+)$/);
    if (!match || !args || args.length === 0) {
      return;
    }

    const group = parseInt(match[1], 10);
    const active = args[0] === 1;
    const state = this.getMuteGroupState(group);
    state.active = active;

    for (const [contextId, contextState] of this.contextStates.entries()) {
      if (contextState.muteGroup === group) {
        this.updateButtonForContext(contextId).catch((error) => {
          streamDeck.logger.error("Failed to update mute group button state:", error);
        });
      }
    }
  }

  private getMuteGroupState(group: number) {
    if (!this.muteGroupStates.has(group)) {
      this.muteGroupStates.set(group, { active: false });
    }
    return this.muteGroupStates.get(group)!;
  }

  private async updateButtonForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const state = this.getMuteGroupState(contextState.muteGroup);
    const settings = await contextState.action.getSettings();
    const groupName = settings.muteGroupName || `Mute Group ${contextState.muteGroup}`;
    const status = state.active ? "ACTIVE" : "INACTIVE";

    await contextState.action.setState(state.active ? 1 : 0);
    await contextState.action.setTitle(`${groupName}\n${status}`);
  }

  /* private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const groupName = settings.muteGroupName || `Mute Group ${settings.muteGroup || '?'}`;
    const status = this.muteGroupActive ? "ACTIVE" : "INACTIVE";
    await action.setTitle(`${groupName}\\n${status}`);
  } */

  private async subscribeToMuteGroup(muteGroup: number): Promise<void> {
    if (!this.x32Client || !this.x32Client.isConnected()) return;
    if (this.subscribedGroups.has(muteGroup)) return;

    this.subscribedGroups.add(muteGroup);
    this.x32Client.subscribeToMuteGroup(muteGroup);
  }

  private async requestMuteGroupState(muteGroup: number): Promise<void> {
    if (!this.x32Client || !this.x32Client.isConnected()) return;
    await this.x32Client.getMuteGroupState(muteGroup);
  }

}