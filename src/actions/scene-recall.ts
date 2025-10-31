import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  scene?: number;
  sceneName?: string;
  confirmRecall?: boolean; // Require double-tap for scene recall
};

@action({ UUID: "com.wheatland-community-church.behringer-x32.scene" })
export class SceneRecallAction extends SingletonAction<Settings> {
  private x32Client: X32Client | null = null;
  private lastKeyPressTime: number = 0;
  private readonly DOUBLE_TAP_THRESHOLD = 500; // milliseconds

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const settings = ev.payload.settings;
    
    // Set default values if not configured
    if (!settings.x32Host) {
      await ev.action.setSettings({
        ...settings,
        x32Host: "192.168.1.100",
        scene: 1,
        sceneName: "Scene 1",
        confirmRecall: true
      });
    }

    const currentSettings = await ev.action.getSettings();
    await this.connectToX32(currentSettings);
    await this.updateButtonTitle(ev.action);
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

    if (!settings.scene) {
      streamDeck.logger.error("Scene not configured");
      await ev.action.showAlert();
      return;
    }

    try {
      const currentTime = Date.now();
      const isDoubleTab = currentTime - this.lastKeyPressTime < this.DOUBLE_TAP_THRESHOLD;
      this.lastKeyPressTime = currentTime;

      if (settings.confirmRecall && !isDoubleTab) {
        // First tap - show confirmation prompt
        await ev.action.setTitle(`${settings.sceneName || `Scene ${settings.scene}`}\\nTap again\\nto RECALL`);
        
        // Reset title after 2 seconds
        setTimeout(async () => {
          await this.updateButtonTitle(ev.action);
        }, 2000);
        
        streamDeck.logger.info(`Scene ${settings.scene} - awaiting confirmation`);
      } else {
        // Second tap or no confirmation required - recall the scene
        await this.x32Client.recallScene(settings.scene);
        await ev.action.setTitle(`${settings.sceneName || `Scene ${settings.scene}`}\\nRECALLED`);
        await ev.action.showOk();
        
        // Reset title after 2 seconds
        setTimeout(async () => {
          await this.updateButtonTitle(ev.action);
        }, 2000);
        
        streamDeck.logger.info(`Scene ${settings.scene} recalled`);
      }
    } catch (error) {
      streamDeck.logger.error("Failed to recall scene:", error);
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

      await this.x32Client.connect();
      
      streamDeck.logger.info(`Connected to X32 at ${settings.x32Host}:10023`);
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
    }
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = await action.getSettings();
    const sceneName = settings.sceneName || `Scene ${settings.scene || '?'}`;
    const title = settings.confirmRecall ? `${sceneName}\\n(Double-tap)` : sceneName;
    await action.setTitle(title);
  }
}