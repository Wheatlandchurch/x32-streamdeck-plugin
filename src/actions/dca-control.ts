import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  dca?: number;
  dcaName?: string;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.dca" })
export class DCAControlAction extends SingletonAction<Settings> {
  // Support multiple X32 connections (one per host)
  private x32Clients: Map<string, X32Client> = new Map();
  private hostSubscriptions: Map<string, Set<number>> = new Map();

  // Keep per-context state (since this is a SingletonAction, multiple keys can exist simultaneously)
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      dca: number;
    }
  > = new Map();

  // Track per-DCA state per host
  private dcaStates: Map<string, Map<number, { muted: boolean }>> = new Map();
  private subscribedDCAs: Set<number> = new Set();

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;

    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        dca: 1,
        dcaName: "DCA 1"
      });
    }

    const currentSettings = await ev.action.getSettings();
    const host = currentSettings.x32Host!;
    const dca = currentSettings.dca ?? 1;

    // Track this action instance for updates
    const contextId = ev.action.id;
    this.contextStates.set(contextId, {
      action: ev.action,
      host,
      dca
    });

    await this.ensureConnected(host);
    await this.subscribeToDCA(host, dca);
    await this.requestDCAState(host, dca);
    await this.updateButtonForContext(contextId);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);
    this.contextStates.delete(contextId);

    if (!contextState) {
      return;
    }

    const { host, dca } = contextState;

    // If no remaining context uses this DCA on this host, unsubscribe and clear cached state
    if (![...this.contextStates.values()].some(cs => cs.host === host && cs.dca === dca)) {
      const hostDCAs = this.hostSubscriptions.get(host);
      if (hostDCAs) {
        hostDCAs.delete(dca);
        const client = this.x32Clients.get(host);
        if (client) {
          client.unsubscribeFromDCA(dca);
        }
      }
      const hostStates = this.dcaStates.get(host);
      if (hostStates) {
        hostStates.delete(dca);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for DCA action");
      await ev.action.showAlert();
      return;
    }

    const { host, dca } = contextState;

    const client = await this.ensureConnected(host);
    if (!client || !client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    const hostStates = this.dcaStates.get(host) || new Map();
    const state = hostStates.get(dca) || { muted: false };
    state.muted = !state.muted;
    hostStates.set(dca, state);
    this.dcaStates.set(host, hostStates);

    try {
      await client.muteDCA(dca, state.muted);
      await this.updateButtonForContext(contextId);
      await ev.action.showOk();

      streamDeck.logger.info(`DCA ${dca} ${state.muted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      streamDeck.logger.error("Failed to toggle DCA mute:", error);
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

  private async ensureConnected(host: string): Promise<X32Client> {
    if (this.x32Clients.has(host)) {
      const client = this.x32Clients.get(host)!;
      if (client.isConnected()) {
        return client;
      }
      // Client exists but not connected, remove it
      client.disconnect();
      this.x32Clients.delete(host);
    }

    try {
      const client = new X32Client({
        host,
        port: 10023
      });

      client.on('error', (error) => {
        streamDeck.logger.error(`X32 Client error for ${host}:`, error);
      });

      client.on('message', (msg) => {
        this.handleX32Message(msg, host);
      });

      await client.connect();
      this.x32Clients.set(host, client);
      
      // Re-subscribe to any DCAs we were previously tracking for this host
      const hostDCAs = this.hostSubscriptions.get(host) || new Set();
      for (const dca of hostDCAs) {
        client.subscribeToDCA(dca);
        client.getDCAMuteStatus(dca).catch(() => {});
      }

      streamDeck.logger.info(`Connected to X32 at ${host}:10023`);
      return client;
    } catch (error) {
      streamDeck.logger.error(`Failed to connect to X32 at ${host}:`, error);
      throw error;
    }
  }

  private handleX32Message(msg: { address: string; args: any[] }, host: string): void {
    const match = msg.address.match(/^\/dca\/(\d+)\/on$/);
    if (!match || msg.args.length === 0) {
      return;
    }

    const dca = parseInt(match[1], 10);
    const isOn = msg.args[0] === 1;
    
    const hostStates = this.dcaStates.get(host) || new Map();
    const state = hostStates.get(dca) || { muted: false };
    state.muted = !isOn;
    hostStates.set(dca, state);
    this.dcaStates.set(host, hostStates);

    for (const [contextId, contextState] of this.contextStates.entries()) {
      if (contextState.host === host && contextState.dca === dca) {
        this.updateButtonForContext(contextId).catch((error) => {
          streamDeck.logger.error("Failed to update DCA button state:", error);
        });
      }
    }
  }

  private getDCAState(host: string, dca: number) {
    const hostStates = this.dcaStates.get(host) || new Map();
    if (!hostStates.has(dca)) {
      hostStates.set(dca, { muted: false });
      this.dcaStates.set(host, hostStates);
    }
    return hostStates.get(dca)!;
  }

  private async updateButtonForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const dcaState = this.getDCAState(contextState.host, contextState.dca);
    const settings = await contextState.action.getSettings();
    const dcaName = settings.dcaName || `DCA ${contextState.dca}`;
    const status = dcaState.muted ? "MUTED" : "ACTIVE";

    await contextState.action.setState(dcaState.muted ? 1 : 0);
    await contextState.action.setTitle(`${dcaName}\n${status}`);
  }

  private async subscribeToDCA(host: string, dca: number): Promise<void> {
    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) return;

    const hostDCAs = this.hostSubscriptions.get(host) || new Set();
    if (hostDCAs.has(dca)) return;

    hostDCAs.add(dca);
    this.hostSubscriptions.set(host, hostDCAs);
    client.subscribeToDCA(dca);
  }

  private async requestDCAState(host: string, dca: number): Promise<void> {
    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) return;
    await client.getDCAMuteStatus(dca);
  }

}
