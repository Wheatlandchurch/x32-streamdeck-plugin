import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  channel?: number;
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.mute" })
export class ChannelMuteAction extends SingletonAction<Settings> {
  // Support multiple X32 connections (one per host)
  private x32Clients: Map<string, X32Client> = new Map();
  private hostSubscriptions: Map<string, Set<number>> = new Map();

  // Keep per-context state (since this is a SingletonAction, multiple keys can exist simultaneously)
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      channel: number;
    }
  > = new Map();

  // Track the latest mute state per channel per host
  private channelMuteStates: Map<string, Map<number, boolean>> = new Map();
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
    await this.subscribeToChannel(host, channel);
    await this.requestChannelState(host, channel);
    await this.updateButtonStateForContext(contextId);
  }

  override async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const state = this.contextStates.get(contextId);

    const channel = state?.channel;
    const host = state?.host;

    // Remove this action instance
    this.contextStates.delete(contextId);

    // If no remaining context is using this channel on this host, unsubscribe
    if (channel && host && !this.isChannelUsedOnHost(host, channel)) {
      const hostChannels = this.hostSubscriptions.get(host);
      if (hostChannels) {
        hostChannels.delete(channel);
        const client = this.x32Clients.get(host);
        if (client) {
          client.unsubscribeFromChannel(channel);
        }
      }
      const hostStates = this.channelMuteStates.get(host);
      if (hostStates) {
        hostStates.delete(channel);
      }
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

    const client = await this.ensureConnected(host);
    if (!client || !client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    const hostStates = this.channelMuteStates.get(host) || new Map();
    const currentMuted = hostStates.get(channel) ?? false;
    const newMuted = !currentMuted;

    try {
      await client.muteChannel(channel, newMuted);
      hostStates.set(channel, newMuted);
      this.channelMuteStates.set(host, hostStates);
      await this.updateButtonStateForContext(contextId);
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
      
      // Re-subscribe to any channels we were previously tracking for this host
      const hostChannels = this.hostSubscriptions.get(host) || new Set();
      for (const channel of hostChannels) {
        client.subscribeToChannel(channel);
        client.getChannelMuteStatus(channel).catch(() => {});
      }

      streamDeck.logger.info(`Connected to X32 at ${host}:10023`);
      return client;
    } catch (error) {
      streamDeck.logger.error(`Failed to connect to X32 at ${host}:`, error);
      throw error;
    }
  }

  private async subscribeToChannel(host: string, channel: number): Promise<void> {
    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) return;

    const hostChannels = this.hostSubscriptions.get(host) || new Set();
    if (hostChannels.has(channel)) return;

    hostChannels.add(channel);
    this.hostSubscriptions.set(host, hostChannels);
    client.subscribeToChannel(channel);
  }

  private async requestChannelState(host: string, channel: number): Promise<void> {
    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) return;
    await client.getChannelMuteStatus(channel);
  }

  private handleX32Message(msg: { address: string; args: any[] }, host: string): void {
    // Handle only mute state messages for channels (e.g. /ch/01/mix/on)
    const match = msg.address.match(/^\/ch\/(\d{2})\/mix\/on$/);
    if (!match || msg.args.length === 0) {
      return;
    }

    const channel = parseInt(match[1], 10);
    const isOn = msg.args[0] === 1;
    const muted = !isOn;

    const hostStates = this.channelMuteStates.get(host) || new Map();
    hostStates.set(channel, muted);
    this.channelMuteStates.set(host, hostStates);

    // Update any contexts that care about this channel on this host
    for (const [context, state] of this.contextStates.entries()) {
      if (state.host === host && state.channel === channel) {
        this.updateButtonStateForContext(context).catch((error) => {
          streamDeck.logger.error("Failed to update button state:", error);
        });
      }
    }
  }

  private async updateButtonStateForContext(context: string): Promise<void> {
    const state = this.contextStates.get(context);
    if (!state) return;

    const hostStates = this.channelMuteStates.get(state.host) || new Map();
    const muted = hostStates.get(state.channel) ?? false;
    await state.action.setState(muted ? 1 : 0);
  }

  private isChannelUsedOnHost(host: string, channel: number): boolean {
    for (const state of this.contextStates.values()) {
      if (state.host === host && state.channel === channel) {
        return true;
      }
    }
    return false;
  }
}
