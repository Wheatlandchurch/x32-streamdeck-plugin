import { Client, Server } from 'node-osc';
import { EventEmitter } from 'events';

export interface X32Config {
  host: string;
  port: number;
}

export class X32Client extends EventEmitter {
  private client: Client;
  private server: Server;
  private config: X32Config;
  private connected: boolean = false;
  private subscriptions: Set<string> = new Set();

  constructor(config: X32Config) {
    super();
    this.config = config;
    this.client = new Client(config.host, config.port);
    this.server = new Server(0, '0.0.0.0'); // Listen on random port for responses
    this.setupServer();
  }

  private setupServer(): void {
    this.server.on('message', (msg: any) => {
      try {
        const [address, ...args] = msg;
        this.emit('message', { address, args });
        
        // Handle specific message types
        if (typeof address === 'string') {
          this.emit(`message:${address}`, { address, args });
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    this.server.on('error', (error: any) => {
      this.connected = false;
      this.emit('error', error);
    });
  }

  async connect(): Promise<void> {
    try {
      // Send info command to check connectivity
      await this.send('/info');
      this.connected = true;
      this.emit('connected');
      
      // Set up periodic status requests for subscribed channels
      this.startStatusPolling();
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  disconnect(): void {
    this.connected = false;
    this.client.close();
    this.server.close();
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(address: string, ...args: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client.send(address, ...args, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Channel control methods
  async muteChannel(channel: number, muted: boolean): Promise<void> {
    const address = `/ch/${channel.toString().padStart(2, '0')}/mix/on`;
    await this.send(address, muted ? 0 : 1);
  }

  async setChannelFader(channel: number, level: number): Promise<void> {
    // Level should be between 0.0 and 1.0
    const clampedLevel = Math.max(0, Math.min(1, level));
    const address = `/ch/${channel.toString().padStart(2, '0')}/mix/fader`;
    await this.send(address, clampedLevel);
  }

  async getChannelMuteStatus(channel: number): Promise<void> {
    const address = `/ch/${channel.toString().padStart(2, '0')}/mix/on`;
    await this.send(address);
  }

  async getChannelFaderLevel(channel: number): Promise<void> {
    const address = `/ch/${channel.toString().padStart(2, '0')}/mix/fader`;
    await this.send(address);
  }

  // DCA control methods
  async muteDCA(dca: number, muted: boolean): Promise<void> {
    const address = `/dca/${dca}/on`;
    await this.send(address, muted ? 0 : 1);
  }

  async setDCAFader(dca: number, level: number): Promise<void> {
    const clampedLevel = Math.max(0, Math.min(1, level));
    const address = `/dca/${dca}/fader`;
    await this.send(address, clampedLevel);
  }

  async getDCAMuteStatus(dca: number): Promise<void> {
    const address = `/dca/${dca}/on`;
    await this.send(address);
  }

  // Scene control methods
  async recallScene(scene: number): Promise<void> {
    const address = `/scene/go/${scene}`;
    await this.send(address);
  }

  async loadScene(scene: number): Promise<void> {
    const address = `/scene/load/${scene}`;
    await this.send(address);
  }

  // Subscription management for status updates
  subscribeToChannel(channel: number): void {
    this.subscriptions.add(`ch_${channel}`);
  }

  subscribeToDCA(dca: number): void {
    this.subscriptions.add(`dca_${dca}`);
  }

  unsubscribeFromChannel(channel: number): void {
    this.subscriptions.delete(`ch_${channel}`);
  }

  unsubscribeFromDCA(dca: number): void {
    this.subscriptions.delete(`dca_${dca}`);
  }

  private startStatusPolling(): void {
    if (!this.connected) return;

    // Poll every 500ms for subscribed channels/DCAs
    const pollInterval = setInterval(() => {
      if (!this.connected) {
        clearInterval(pollInterval);
        return;
      }

      this.subscriptions.forEach(subscription => {
        if (subscription.startsWith('ch_')) {
          const channel = parseInt(subscription.split('_')[1]);
          this.getChannelMuteStatus(channel).catch(() => {});
          this.getChannelFaderLevel(channel).catch(() => {});
        } else if (subscription.startsWith('dca_')) {
          const dca = parseInt(subscription.split('_')[1]);
          this.getDCAMuteStatus(dca).catch(() => {});
        }
      });
    }, 500);

    this.on('disconnected', () => {
      clearInterval(pollInterval);
    });
  }
}