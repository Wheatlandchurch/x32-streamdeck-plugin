import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  dca?: number;
  dcaName?: string;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.dca" })
export class DCAControlAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private connectedHost: string | null = null;

  // Keep per-context state (since this is a SingletonAction, multiple keys can exist simultaneously)
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      dca: number;
    }
  > = new Map();

  // Track the current mute state per DCA so we don't mix state between buttons
  private dcaStates: Map<number, { muted: boolean }> = new Map();
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
    await this.subscribeToDCA(dca);
    await this.requestDCAState(dca);
    await this.updateButtonForContext(contextId);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);
    this.contextStates.delete(contextId);

    if (!contextState) {
      return;
    }

    const { dca } = contextState;

    // If no remaining context uses this DCA, unsubscribe and clear cached state
    if (![...this.contextStates.values()].some(cs => cs.dca === dca)) {
      this.subscribedDCAs.delete(dca);
      this.x32Client?.unsubscribeFromDCA(dca);
      this.dcaStates.delete(dca);
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

    await this.ensureConnected(host);
    if (!this.x32Client || !this.x32Client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    const state = this.getDCAState(dca);
    state.muted = !state.muted;

    try {
      await this.x32Client.muteDCA(dca, state.muted);
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

      // Re-subscribe to any DCAs we were previously tracking
      for (const dca of this.subscribedDCAs) {
        await this.x32Client.subscribeToDCA(dca);
        await this.requestDCAState(dca);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
      this.connectedHost = null;
    }
  }

  private handleX32Message(msg: { address: string; args: any[] }): void {
    const match = msg.address.match(/^\/dca\/(\d+)\/on$/);
    if (!match || msg.args.length === 0) {
      return;
    }

    const dca = parseInt(match[1], 10);
    const isOn = msg.args[0] === 1;
    const state = this.getDCAState(dca);
    state.muted = !isOn;

    for (const [contextId, contextState] of this.contextStates.entries()) {
      if (contextState.dca === dca) {
        this.updateButtonForContext(contextId).catch((error) => {
          streamDeck.logger.error("Failed to update DCA button state:", error);
        });
      }
    }
  }

  private getDCAState(dca: number) {
    if (!this.dcaStates.has(dca)) {
      this.dcaStates.set(dca, { muted: false });
    }
    return this.dcaStates.get(dca)!;
  }

  private async updateButtonForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const dcaState = this.getDCAState(contextState.dca);
    const settings = await contextState.action.getSettings();
    const dcaName = settings.dcaName || `DCA ${contextState.dca}`;
    const status = dcaState.muted ? "MUTED" : "ACTIVE";

    await contextState.action.setState(dcaState.muted ? 1 : 0);
    await contextState.action.setTitle(`${dcaName}\n${status}`);
  }

}
