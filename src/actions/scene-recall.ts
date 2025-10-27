import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { X32Client } from "../x32-client";

type Settings = {
  x32Host?: string;
  x32Port?: number;
  scene?: number;
  sceneName?: string;
  confirmRecall?: boolean; // Require double-tap for scene recall
};

@action({ UUID: "com.wheatlandchurch.x32-mixer.scene" })
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
        x32Port: 10023,
        scene: 1,
        sceneName: "Scene 1",
        confirmRecall: true
      });
    }

    await this.connectToX32(ev.action.getSettings());
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
        // First tap - just load the scene (preview)
        await this.x32Client.loadScene(settings.scene);
        await ev.action.setTitle(`${settings.sceneName || `Scene ${settings.scene}`}\\nLoaded\\n(Tap again to GO)`);
        
        // Reset title after 2 seconds
        setTimeout(async () => {
          await this.updateButtonTitle(ev.action);
        }, 2000);
        
        streamDeck.logger.info(`Scene ${settings.scene} loaded (preview)`);
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

      await this.x32Client.connect();
      
      streamDeck.logger.info(`Connected to X32 at ${settings.x32Host}:${settings.x32Port}`);
    } catch (error) {
      streamDeck.logger.error("Failed to connect to X32:", error);
      this.x32Client = null;
    }
  }

  private async updateButtonTitle(action: any): Promise<void> {
    const settings = action.getSettings();
    const sceneName = settings.sceneName || `Scene ${settings.scene || '?'}`;
    const title = settings.confirmRecall ? `${sceneName}\\n(Double-tap)` : sceneName;
    await action.setTitle(title);
  }
}