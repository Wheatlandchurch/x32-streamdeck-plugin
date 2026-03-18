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
  private x32Client: X32Client | null = null;
  private connectedHost: string | null = null;

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
  private channelStates: Map<
    number,
    {
      level: number;
      muted: boolean;
      initialized: boolean;
      pendingFaderUpdate: number | null;
      faderUpdateTimer: NodeJS.Timeout | null;
    }
  > = new Map();

  private readonly FADER_UPDATE_DELAY = 50; // milliseconds - smooth but not overwhelming

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
    await this.subscribeToChannel(channel);
    await this.requestChannelState(channel);

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

    await this.ensureConnected(host);
    if (!this.x32Client || !this.x32Client.isConnected()) {
      streamDeck.logger.error("Failed to connect to X32");
      await ev.action.showAlert();
      return;
    }

    // On key press, reset fader to unity (0.75 in X32 terms, which is 0dB)
    const unityLevel = 0.75;

    try {
      await this.x32Client.setChannelFader(channel, unityLevel);
      const channelState = this.getChannelState(channel);
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

    if (!this.x32Client || !this.x32Client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    const channelState = this.getChannelState(channel);
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
          await this.x32Client!.setChannelFader(channel, channelState.pendingFaderUpdate);
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

    const { channel } = contextState;

    if (!this.x32Client || !this.x32Client.isConnected()) {
      return;
    }

    try {
      const channelState = this.getChannelState(channel);

      // Toggle between current level and unity (0dB)
      const unityLevel = 0.75;
      const newLevel = Math.abs(channelState.level - unityLevel) < 0.01 ? 0 : unityLevel;

      await this.x32Client.setChannelFader(channel, newLevel);
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

    if (!this.x32Client || !this.x32Client.isConnected()) {
      await ev.action.showAlert();
      return;
    }

    const { channel } = contextState;

    try {
      const dialAction = ev.payload.settings.dialPressAction || 'mute';
      const channelState = this.getChannelState(channel);

      switch (dialAction) {
        case 'mute':
          // Toggle mute/unmute
          channelState.muted = !channelState.muted;
          await this.x32Client.muteChannel(channel, channelState.muted);
          await this.updateButtonTitleForContext(contextId);
          streamDeck.logger.info(`Channel ${channel} ${channelState.muted ? 'muted' : 'unmuted'}`);
          break;

        case 'unity':
          // Set to unity (0dB)
          const unityLevel = 0.75;
          channelState.level = unityLevel;
          channelState.initialized = true;
          await this.x32Client.setChannelFader(channel, unityLevel);
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
        await this.requestChannelState(channel);
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
    await this.x32Client.getChannelFaderLevel(channel);
    await this.x32Client.getChannelMuteStatus(channel);
  }

  private handleX32Message(msg: { address: string; args: any[] }): void {
    // Handle fader level updates
    const faderMatch = msg.address.match(/^\/ch\/(\d{2})\/mix\/fader$/);
    if (faderMatch && msg.args.length > 0) {
      const channel = parseInt(faderMatch[1], 10);
      const level = parseFloat(msg.args[0]);
      const state = this.getChannelState(channel);
      state.level = level;
      state.initialized = true;

      // Update any contexts that care about this channel
      for (const [contextId, contextState] of this.contextStates.entries()) {
        if (contextState.channel === channel) {
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
      const state = this.getChannelState(channel);
      state.muted = !isOn;

      for (const [contextId, contextState] of this.contextStates.entries()) {
        if (contextState.channel === channel) {
          this.updateButtonTitleForContext(contextId).catch((error) => {
            streamDeck.logger.error("Failed to update button title:", error);
          });
        }
      }
    }
  }





  private getChannelState(channel: number) {
    if (!this.channelStates.has(channel)) {
      this.channelStates.set(channel, {
        level: 0,
        muted: false,
        initialized: false,
        pendingFaderUpdate: null,
        faderUpdateTimer: null
      });
    }

    return this.channelStates.get(channel)!;
  }

  private async updateButtonTitleForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const channelState = this.getChannelState(contextState.channel);
    const dBLevel = this.levelToDb(channelState.level);
    const muteStatus = channelState.muted ? " (MUTED)" : "";
    const title = `Ch${contextState.channel}\n${dBLevel}dB${muteStatus}`;

    await contextState.action.setTitle(title);
  }

  private async updateDialFeedbackForContext(contextId: string): Promise<void> {
    const contextState = this.contextStates.get(contextId);
    if (!contextState) return;

    const channelState = this.getChannelState(contextState.channel);
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