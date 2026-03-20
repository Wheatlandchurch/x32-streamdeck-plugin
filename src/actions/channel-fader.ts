import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, DialRotateEvent, TouchTapEvent, DialDownEvent, DialUpEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  channel?: number;
  step?: number; // Step size for fader adjustments (0.01 to 0.1)
  fineStep?: number; // Fine step size when holding dial (0.001 to 0.01)
  dialPressAction?: 'mute' | 'unity' | 'fine'; // What happens when dial is pressed
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.fader" })
export class ChannelFaderAction extends SingletonAction<Settings> {
  // Support multiple X32 connections (one per host)
  private x32Clients: Map<string, X32Client> = new Map();
  private hostSubscriptions: Map<string, Set<number>> = new Map();

  // Track per-context state to support multiple keys using different channels
  private contextStates: Map<
    string,
    {
      action: any;
      host: string;
      channel: number;
      isDialPressed: boolean;
    }
  > = new Map();

  // Track per-channel X32 state so multiple contexts sharing the same channel stay in sync
  private channelStates: Map<string, Map<number, {
    level: number;
    muted: boolean;
    initialized: boolean;
    pendingFaderUpdate: number | null;
    faderUpdateTimer: NodeJS.Timeout | null;
  }>> = new Map();

  private readonly FADER_UPDATE_DELAY = 50; // milliseconds - smooth but not overwhelming
  private subscribedChannels: Set<number> = new Set();

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;

    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        channel: 1,
        step: 0.05,
        fineStep: 0.01,
        dialPressAction: 'mute'
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
      channel,
      isDialPressed: false
    });

    await this.ensureConnected(host);
    await this.subscribeToChannel(host, channel);
    await this.requestChannelState(host, channel);

    // Ensure UI reflects the latest known state (may be initialized via polling)
    await this.updateButtonTitleForContext(contextId);
    await this.updateDialFeedbackForContext(contextId);
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for fader action");
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

    // On key press, reset fader to unity (0.75 in X32 terms, which is 0dB)
    const unityLevel = 0.75;

    try {
      await client.setChannelFader(channel, unityLevel);
      const channelState = this.getChannelState(host, channel);
      channelState.level = unityLevel;
      channelState.initialized = true;

      await this.updateButtonTitleForContext(contextId);
      await this.updateDialFeedbackForContext(contextId);
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Failed to set fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialRotate(ev: DialRotateEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for fader action");
      return;
    }

    const { host, channel } = contextState;

    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    const channelState = this.getChannelState(host, channel);
    if (!channelState.initialized) {
      streamDeck.logger.warn("Waiting for initial fader level from X32...");
      return;
    }

    try {
      // Use fine step when dial is pressed AND dialPressAction is 'fine'
      const useFineStep = contextState.isDialPressed && (ev.payload.settings.dialPressAction === 'fine');
      const stepSize = useFineStep ? (ev.payload.settings.fineStep || 0.01) : (ev.payload.settings.step || 0.05);
      const ticks = ev.payload.ticks;
      const newLevel = Math.max(0, Math.min(1, channelState.level + (ticks * stepSize)));

      // Store the pending level
      channelState.pendingFaderUpdate = newLevel;
      channelState.level = newLevel;

      // Update UI immediately for responsiveness
      await this.updateButtonTitleForContext(contextId);
      await this.updateDialFeedbackForContext(contextId);

      // Throttle the actual OSC commands to avoid flooding
      if (channelState.faderUpdateTimer) {
        clearTimeout(channelState.faderUpdateTimer);
      }

      channelState.faderUpdateTimer = setTimeout(async () => {
        if (channelState.pendingFaderUpdate !== null) {
          await client.setChannelFader(channel, channelState.pendingFaderUpdate);
          channelState.pendingFaderUpdate = null;
        }
      }, this.FADER_UPDATE_DELAY);

    } catch (error) {
      streamDeck.logger.error("Failed to adjust fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onTouchTap(ev: TouchTapEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for fader action");
      return;
    }

    const { host, channel } = contextState;

    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) {
      return;
    }

    try {
      const channelState = this.getChannelState(host, channel);

      // Toggle between current level and unity (0dB)
      const unityLevel = 0.75;
      const newLevel = Math.abs(channelState.level - unityLevel) < 0.01 ? 0 : unityLevel;

      await client.setChannelFader(channel, newLevel);
      channelState.level = newLevel;
      channelState.initialized = true;

      await this.updateButtonTitleForContext(contextId);
      await this.updateDialFeedbackForContext(contextId);
    } catch (error) {
      streamDeck.logger.error("Failed to set fader level:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialDown(ev: DialDownEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      streamDeck.logger.error("Missing context state for fader action");
      return;
    }

    contextState.isDialPressed = true;

    const { host, channel } = contextState;
    const client = this.x32Clients.get(host);
    if (!client || !client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    try {
      const dialAction = ev.payload.settings.dialPressAction || 'mute';
      const channelState = this.getChannelState(host, channel);

      switch (dialAction) {
        case 'mute':
          // Toggle mute/unmute
          channelState.muted = !channelState.muted;
          await client.muteChannel(channel, channelState.muted);
          await this.updateButtonTitleForContext(contextId);
          streamDeck.logger.info(`Channel ${channel} ${channelState.muted ? 'muted' : 'unmuted'}`);
          break;

        case 'unity':
          // Set to unity (0dB)
          const unityLevel = 0.75;
          channelState.level = unityLevel;
          channelState.initialized = true;
          await client.setChannelFader(channel, unityLevel);
          await this.updateButtonTitleForContext(contextId);
          await this.updateDialFeedbackForContext(contextId);
          streamDeck.logger.info(`Channel ${channel} set to unity (0dB)`);
          break;

        case 'fine':
          // Enable fine adjustment mode (handled in onDialRotate)
          streamDeck.logger.info("Fine adjustment mode enabled");
          break;
      }
    } catch (error) {
      streamDeck.logger.error("Failed to execute dial press action:", error);
      await ev.action.showAlert();
    }
  }

  override async onDialUp(ev: DialUpEvent<Settings>): Promise<void> {
    const contextId = ev.action.id;
    const contextState = this.contextStates.get(contextId);

    if (!contextState) {
      return;
    }

    contextState.isDialPressed = false;

    const dialAction = ev.payload.settings.dialPressAction || 'mute';
    if (dialAction === 'fine') {
      streamDeck.logger.info("Fine adjustment mode disabled");
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
        client.getChannelFaderLevel(channel).catch(() => {});
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
    await client.getChannelFaderLevel(channel);
    await client.getChannelMuteStatus(channel);
  }

  private handleX32Message(msg: { address: string; args: any[] }, host: string): void {
    // Handle fader level updates
    const faderMatch = msg.address.match(/^\/ch\/(\d{2})\/mix\/fader$/);
    if (faderMatch && msg.args.length > 0) {
      const channel = parseInt(faderMatch[1], 10);
      const level = parseFloat(msg.args[0]);
      const state = this.getChannelState(host, channel);
      state.level = level;
      state.initialized = true;

      // Update any contexts that care about this channel on this host
      for (const [contextId, contextState] of this.contextStates.entries()) {
        if (contextState.host === host && contextState.channel === channel) {
          this.updateButtonTitleForContext(contextId).catch((error) => {
            streamDeck.logger.error("Failed to update button title:", error);
          });
          this.updateDialFeedbackForContext(contextId).catch((error) => {
            streamDeck.logger.error("Failed to update dial feedback:", error);
          });
        }
      }

      return;
    }

    // Handle mute state updates
    const muteMatch = msg.address.match(/^\/ch\/(\d{2})\/mix\/on$/);
    if (muteMatch && msg.args.length > 0) {
      const channel = parseInt(muteMatch[1], 10);
      const isOn = msg.args[0] === 1;
      const state = this.getChannelState(host, channel);
      state.muted = !isOn;

      for (const [contextId, contextState] of this.contextStates.entries()) {
        if (contextState.host === host && contextState.channel === channel) {
          this.updateButtonTitleForContext(contextId).catch((error) => {
            streamDeck.logger.error("Failed to update button title:", error);
          });
        }
      }
    }
  }





  private getChannelState(host: string, channel: number) {
    const hostStates = this.channelStates.get(host) || new Map();
    if (!hostStates.has(channel)) {
      hostStates.set(channel, {
        level: 0,
        muted: false,
        initialized: false,
        pendingFaderUpdate: null,
        faderUpdateTimer: null
      });
      this.channelStates.set(host, hostStates);
    }

    return hostStates.get(channel)!;
  }

  private async updateButtonTitleForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const channelState = this.getChannelState(contextState.host, contextState.channel);
    const dBLevel = this.levelToDb(channelState.level);
    const muteStatus = channelState.muted ? " (MUTED)" : "";
    const title = `Ch${contextState.channel}\n${dBLevel}dB${muteStatus}`;

    await contextState.action.setTitle(title);
  }

  private async updateDialFeedbackForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const channelState = this.getChannelState(contextState.host, contextState.channel);
    const percentage = Math.round(channelState.level * 100);

    if (typeof contextState.action.setFeedback === 'function') {
      await contextState.action.setFeedback({
        value: percentage,
        opacity: 100
      });
    } else if (typeof contextState.action.setIndicator === 'function') {
      await contextState.action.setIndicator(percentage);
    }
  }

  private levelToDb(level: number): string {
    if (level === 0) return "-∞";
    
    // X32 fader curve approximation
    let db: number;
    if (level <= 0.75) {
      // Below unity gain
      db = (level / 0.75) * 0 - 60;
    } else {
      // Above unity gain
      db = ((level - 0.75) / 0.25) * 10;
    }
    
    return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
  }
}