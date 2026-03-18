import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  channel?: number;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.mute" })
export class ChannelMuteAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private connectedHost: string | null = null;

  // Keep per-context state (since this is a SingletonAction, multiple keys can exist simultaneously)
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      channel: number;
    }
  > = new Map();

  // Track the latest mute state per channel so we don't mix state between contexts
  private channelMuteStates: Map<number, boolean> = new Map();
  private subscribedChannels: Set<number> = new Set();

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;

    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        channel: 1
      });
    }

    const currentSettings = await ev.action.getSettings();
    const host = currentSettings.x32Host!;
    const channel = currentSettings.channel ?? 1;

    // Track this action instance for updates
    const contextId = ev.action.id;
    this.contextStates.set(contextId, {
      action: ev.action,
      host,
      channel
    });

    await this.ensureConnected(host);
    await this.subscribeToChannel(channel);
    await this.requestChannelState(channel);
    await this.updateButtonStateForContext(contextId);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const state = this.contextStates.get(contextId);

    // Remove this action instance
    this.contextStates.delete(contextId);

    const channel = state?.channel;

    // If no remaining context is using this channel, unsubscribe
    if (channel && !this.isChannelUsed(channel)) {
      this.subscribedChannels.delete(channel);
      this.x32Client?.unsubscribeFromChannel(channel);
      this.channelMuteStates.delete(channel);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for mute action");
      await ev.action.showAlert();
      return;
    }

    const { host, channel } = contextState;

    await this.ensureConnected(host);
    if (!this.x32Client || !this.x32Client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    const currentMuted = this.channelMuteStates.get(channel) ?? false;
    const newMuted = !currentMuted;

    try {
      await this.x32Client.muteChannel(channel, newMuted);
      this.channelMuteStates.set(channel, newMuted);
      await this.updateButtonStateForContext(context);
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

      // Re-subscribe to any channels we were previously tracking
      for (const channel of this.subscribedChannels) {
        await this.x32Client.subscribeToChannel(channel);
        await this.x32Client.getChannelMuteStatus(channel);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
      this.connectedHost = null;
    }
  }

  private async subscribeToChannel(channel: number): Promise<void> {
    if (!this.x32Client || !this.x32Client.isConnected()) return;
    if (this.subscribedChannels.has(channel)) return;

    this.subscribedChannels.add(channel);
    this.x32Client.subscribeToChannel(channel);
  }

  private async requestChannelState(channel: number): Promise<void> {
    if (!this.x32Client || !this.x32Client.isConnected()) return;
    await this.x32Client.getChannelMuteStatus(channel);
  }

  private handleX32Message(msg: { address: string; args: any[] }): void {
    // Handle only mute state messages for channels (e.g. /ch/01/mix/on)
    const match = msg.address.match(/^\/ch\/(\d{2})\/mix\/on$/);
    if (!match || msg.args.length === 0) {
      return;
    }

    const channel = parseInt(match[1], 10);
    const isOn = msg.args[0] === 1;
    const muted = !isOn;

    this.channelMuteStates.set(channel, muted);

    // Update any contexts that care about this channel
    for (const [context, state] of this.contextStates.entries()) {
      if (state.channel === channel) {
        this.updateButtonStateForContext(context).catch((error) => {
          streamDeck.logger.error("Failed to update button state:", error);
        });
      }
    }
  }

  private async updateButtonStateForContext(context: string): Promise<void> {
    const state = this.contextStates.get(context);
    if (!state) return;

    const muted = this.channelMuteStates.get(state.channel) ?? false;
    await state.action.setState(muted ? 1 : 0);
  }

  private isChannelUsed(channel: number): boolean {
    for (const state of this.contextStates.values()) {
      if (state.channel === channel) {
        return true;
      }
    }
    return false;
  }
}
