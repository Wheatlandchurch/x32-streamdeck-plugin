import { EventEmitter } from 'events';
import * as dgram from 'dgram';

export interface X32Config {
  host: string;
  port: number;
}

class X32Connection extends EventEmitter {
  private socket: dgram.Socket;
  private config: X32Config;
  private connected: boolean = false;
  private subscriptions: Set<string> = new Set();
  private pendingConnect: Promise<void> | null = null;
  private timers: NodeJS.Timeout[] = [];
  private connectionPromise: {resolve: () => void, reject: (error: Error) => void, timeout: NodeJS.Timeout} | null = null;

  constructor(config: X32Config) {
    super();
    // A mixer connection legitimately serves many visible action instances.
    this.setMaxListeners(0);
    this.config = config;
    console.log(`[X32Client] Creating client for ${config.host}:${config.port}`);
    this.socket = dgram.createSocket('udp4');
    this.setupSocket();
    // Bind to a random port to receive responses
    this.socket.bind();
  }

  private setupSocket(): void {
    this.socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      console.log(`[X32Client] Received OSC message from ${rinfo.address}:${rinfo.port}`);
      
      // If we're waiting for connection confirmation, resolve it now
      if (this.connectionPromise && !this.connected) {
        console.log('[X32Client] First response received, connection successful!');
        clearTimeout(this.connectionPromise.timeout);
        this.connected = true;
        this.connectionPromise.resolve();
        this.connectionPromise = null;
        this.emit('connected');
        this.startStatusPolling();
      }
      
      try {
        // Parse OSC message
        const parsed = this.parseOSCMessage(msg);
        if (parsed) {
          console.log(`[X32Client] Parsed: ${parsed.address}`, parsed.args);
          this.emit('message', parsed);
          
          // Handle specific message types
          if (parsed.address) {
            this.emit(`message:${parsed.address}`, parsed);
          }
        }
      } catch (error) {
        console.error('[X32Client] Error processing message:', error);
        this.emit('error', error);
      }
    });

    this.socket.on('error', (error: any) => {
      console.error('[X32Client] Socket error:', error);
      this.connected = false;
      if (this.connectionPromise) {
        clearTimeout(this.connectionPromise.timeout);
        this.connectionPromise.reject(error);
        this.connectionPromise = null;
      }
      this.emit('error', error);
    });
    
    this.socket.on('listening', () => {
      const addr = this.socket.address();
      console.log(`[X32Client] Socket listening on ${addr.address}:${addr.port}`);
    });
  }

  private parseOSCMessage(msg: Buffer): { address: string; args: any[] } | null {
    try {
      let offset = 0;
      
      // Read OSC address (null-terminated string)
      const addressEnd = msg.indexOf(0, offset);
      if (addressEnd <= 0) return null;
      
      const address = msg.toString('utf8', offset, addressEnd);
      
      // Find type tag string (starts after padding)
      offset = Math.ceil((addressEnd + 1) / 4) * 4;
      if (offset >= msg.length || msg[offset] !== 0x2c) { // 0x2c is ','
        return { address, args: [] };
      }
      
      const typeEnd = msg.indexOf(0, offset);
      if (typeEnd <= 0) return { address, args: [] };
      
      const types = msg.toString('utf8', offset + 1, typeEnd);
      
      // Parse arguments based on types
      offset = Math.ceil((typeEnd + 1) / 4) * 4;
      const args: any[] = [];
      
      for (let i = 0; i < types.length; i++) {
        if (offset >= msg.length) break;
        
        switch (types[i]) {
          case 'i': // int32
            args.push(msg.readInt32BE(offset));
            offset += 4;
            break;
          case 'f': // float32
            args.push(msg.readFloatBE(offset));
            offset += 4;
            break;
          case 's': // string
            const strEnd = msg.indexOf(0, offset);
            if (strEnd > 0) {
              args.push(msg.toString('utf8', offset, strEnd));
              offset = Math.ceil((strEnd + 1) / 4) * 4;
            }
            break;
        }
      }
      
      return { address, args };
    } catch (error) {
      console.error('[X32Client] Error parsing OSC message:', error);
      return null;
    }
  }

  private buildOSCMessage(address: string, ...args: any[]): Buffer {
    const parts: Buffer[] = [];
    
    // Address (null-terminated, padded to 4-byte boundary)
    const addressBuf = Buffer.from(address + '\0');
    const addressPadding = 4 - (addressBuf.length % 4);
    parts.push(addressBuf);
    if (addressPadding < 4) {
      parts.push(Buffer.alloc(addressPadding));
    }
    
    // Type tags
    let typeTags = ',';
    const argBuffers: Buffer[] = [];
    
    for (const arg of args) {
      if (typeof arg === 'number') {
        if (Number.isInteger(arg) && !address.endsWith('/fader')) {
          typeTags += 'i';
          const buf = Buffer.alloc(4);
          buf.writeInt32BE(arg, 0);
          argBuffers.push(buf);
        } else {
          typeTags += 'f';
          const buf = Buffer.alloc(4);
          buf.writeFloatBE(arg, 0);
          argBuffers.push(buf);
        }
      } else if (typeof arg === 'string') {
        typeTags += 's';
        const strBuf = Buffer.from(arg + '\0');
        const strPadding = 4 - (strBuf.length % 4);
        argBuffers.push(strBuf);
        if (strPadding < 4) {
          argBuffers.push(Buffer.alloc(strPadding));
        }
      }
    }
    
    // Add type tags (null-terminated, padded)
    const typeTagsBuf = Buffer.from(typeTags + '\0');
    const typeTagsPadding = 4 - (typeTagsBuf.length % 4);
    parts.push(typeTagsBuf);
    if (typeTagsPadding < 4) {
      parts.push(Buffer.alloc(typeTagsPadding));
    }
    
    // Add arguments
    parts.push(...argBuffers);
    
    return Buffer.concat(parts as any);
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.pendingConnect) return this.pendingConnect;
    this.pendingConnect = this.openConnection().finally(() => {
      this.pendingConnect = null;
    });
    return this.pendingConnect;
  }

  private async openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[X32Client] Attempting to connect to ${this.config.host}:${this.config.port}`);
      
      const timeout = setTimeout(() => {
        console.error('[X32Client] Connection timeout - X32 did not respond within 3 seconds');
        this.connected = false;
        this.connectionPromise = null;
        reject(new Error('Connection timeout - X32 did not respond. Please verify:\n1. X32 IP address is correct\n2. X32 is powered on and connected to network\n3. No firewall is blocking UDP port 10023\n4. X32 remote control is enabled (SETUP → Remote)'));
      }, 3000); // 3 second timeout

      // Store the promise resolvers so the message handler can complete the connection
      this.connectionPromise = { resolve, reject, timeout };

      // Send /xremote to enable remote control (required for bidirectional communication)
      // Note: X32 does NOT respond to /xremote, so we query a channel to test connectivity
      console.log('[X32Client] Sending /xremote command...');
      this.send('/xremote').then(() => {
        console.log('[X32Client] /xremote command sent, now testing with channel query...');
        // Query channel 1 mute status - X32 will respond to this
        return this.send('/ch/01/mix/on');
      }).then(() => {
        console.log('[X32Client] Channel query sent, waiting for response...');
      }).catch((error) => {
        console.error('[X32Client] Failed to send commands:', error);
        clearTimeout(timeout);
        this.connected = false;
        this.connectionPromise = null;
        reject(new Error(`Failed to send command to X32: ${error.message}`));
      });
    });
  }

  disconnect(): void {
    this.connected = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (this.connectionPromise) {
      clearTimeout(this.connectionPromise.timeout);
      this.connectionPromise.reject(new Error('Disconnected'));
      this.connectionPromise = null;
    }
    this.socket.close();
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(address: string, ...args: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[X32Client] Sending OSC message: ${address}`, args.length > 0 ? args : '(no args)');
        const message = this.buildOSCMessage(address, ...args);
        this.socket.send(message as any, 0, message.length, this.config.port, this.config.host, (error) => {
          if (error) {
            console.error(`[X32Client] Error sending ${address}:`, error);
            reject(error);
          } else {
            console.log(`[X32Client] Successfully sent ${address}`);
            resolve();
          }
        });
      } catch (error) {
        console.error(`[X32Client] Exception sending ${address}:`, error);
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
    // X32 scene recall: /load "scene" {number}
    // Scene numbers are 0-indexed
    await this.send('/load', 'scene', scene - 1);
  }

  async loadScene(scene: number): Promise<void> {
    // X32 scene load is the same as recall
    await this.send('/load', 'scene', scene - 1);
  }

  // Mute group control methods
  async setMuteGroup(muteGroup: number, active: boolean): Promise<void> {
    const address = `/config/mute/${muteGroup}`;
    await this.send(address, active ? 1 : 0);
  }

  async getMuteGroupState(muteGroup: number): Promise<void> {
    const address = `/config/mute/${muteGroup}`;
    await this.send(address);
  }

  // Subscription management for status updates
  subscribeToChannel(channel: number): void {
    this.subscriptions.add(`ch_${channel}`);
  }

  subscribeToDCA(dca: number): void {
    this.subscriptions.add(`dca_${dca}`);
  }

  subscribeToMuteGroup(muteGroup: number): void {
    this.subscriptions.add(`mutegroup_${muteGroup}`);
  }

  unsubscribeFromChannel(channel: number): void {
    this.subscriptions.delete(`ch_${channel}`);
  }

  unsubscribeFromDCA(dca: number): void {
    this.subscriptions.delete(`dca_${dca}`);
  }

  unsubscribeFromMuteGroup(muteGroup: number): void {
    this.subscriptions.delete(`mutegroup_${muteGroup}`);
  }

  private startStatusPolling(): void {
    if (!this.connected) return;

    // Renew well before the X32's ten-second subscription timeout.
    // The X32 requires this to maintain bidirectional communication
    const xremoteInterval = setInterval(() => {
      if (!this.connected) {
        clearInterval(xremoteInterval);
        return;
      }
      this.send('/xremote').catch(() => {});
    }, 5000);

    // Poll every 500ms for subscribed channels/DCAs/mute groups
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
        } else if (subscription.startsWith('mutegroup_')) {
          const muteGroup = parseInt(subscription.split('_')[1]);
          this.getMuteGroupState(muteGroup).catch(() => {});
        }
      });
    }, 500);

    this.timers.push(xremoteInterval, pollInterval);
  }
}

// All action types and connection tests share one UDP endpoint per mixer.
// The X32 supports only four /xremote clients; separate sockets per action
// can evict X32 Edit while commands and direct polling continue to work.
type SharedConnection = {
  connection: X32Connection;
  users: Set<X32Client>;
};

export class X32Client extends EventEmitter {
  private static connections = new Map<string, SharedConnection>();
  private shared: SharedConnection;
  private key: string;
  private released = false;
  private subscriptions = new Set<string>();
  private forwardMessage = (message: { address: string; args: any[] }) => {
    this.emit('message', message);
    this.emit(`message:${message.address}`, message);
  };
  private forwardError = (error: Error) => { this.emit('error', error); };
  private forwardConnected = () => { this.emit('connected'); };

  constructor(config: X32Config) {
    super();
    this.key = `${config.host.trim().toLowerCase()}:${config.port}`;
    let shared = X32Client.connections.get(this.key);
    if (!shared) {
      shared = {
        connection: new X32Connection({ ...config, host: config.host.trim() }),
        users: new Set()
      };
      X32Client.connections.set(this.key, shared);
    }
    this.shared = shared;
    shared.users.add(this);
    shared.connection.on('message', this.forwardMessage);
    shared.connection.on('error', this.forwardError);
    shared.connection.on('connected', this.forwardConnected);
  }

  connect(): Promise<void> {
    if (this.released) return Promise.reject(new Error('Client has been disconnected'));
    return this.shared.connection.connect().catch(error => {
      this.disconnect();
      throw error;
    });
  }
  isConnected(): boolean { return !this.released && this.shared.connection.isConnected(); }
  disconnect(): void {
    if (this.released) return;
    for (const subscription of [...this.subscriptions]) this.unsubscribe(subscription);
    this.released = true;
    const { connection, users } = this.shared;
    connection.off('message', this.forwardMessage);
    connection.off('error', this.forwardError);
    connection.off('connected', this.forwardConnected);
    users.delete(this);
    if (users.size === 0) {
      X32Client.connections.delete(this.key);
      connection.disconnect();
    }
    this.emit('disconnected');
  }
  send(address: string, ...args: any[]): Promise<void> {
    if (this.released) return Promise.reject(new Error('Client has been disconnected'));
    return this.shared.connection.send(address, ...args);
  }
  muteChannel(channel: number, muted: boolean) { return this.send(`/ch/${String(channel).padStart(2, '0')}/mix/on`, muted ? 0 : 1); }
  setChannelFader(channel: number, level: number) { return this.send(`/ch/${String(channel).padStart(2, '0')}/mix/fader`, Math.max(0, Math.min(1, level))); }
  getChannelMuteStatus(channel: number) { return this.send(`/ch/${String(channel).padStart(2, '0')}/mix/on`); }
  getChannelFaderLevel(channel: number) { return this.send(`/ch/${String(channel).padStart(2, '0')}/mix/fader`); }
  muteDCA(dca: number, muted: boolean) { return this.send(`/dca/${dca}/on`, muted ? 0 : 1); }
  setDCAFader(dca: number, level: number) { return this.send(`/dca/${dca}/fader`, Math.max(0, Math.min(1, level))); }
  getDCAMuteStatus(dca: number) { return this.send(`/dca/${dca}/on`); }
  recallScene(scene: number) { return this.send('/load', 'scene', scene - 1); }
  loadScene(scene: number) { return this.recallScene(scene); }
  setMuteGroup(group: number, active: boolean) { return this.send(`/config/mute/${group}`, active ? 1 : 0); }
  getMuteGroupState(group: number) { return this.send(`/config/mute/${group}`); }

  private subscribe(key: string): void {
    if (this.released || this.subscriptions.has(key)) return;
    this.subscriptions.add(key);
    const [kind, id] = key.split('_');
    if (kind === 'ch') this.shared.connection.subscribeToChannel(Number(id));
    if (kind === 'dca') this.shared.connection.subscribeToDCA(Number(id));
    if (kind === 'mutegroup') this.shared.connection.subscribeToMuteGroup(Number(id));
  }
  private unsubscribe(key: string): void {
    if (!this.subscriptions.delete(key)) return;
    if ([...this.shared.users].some(user => user.subscriptions.has(key))) return;
    const [kind, id] = key.split('_');
    if (kind === 'ch') this.shared.connection.unsubscribeFromChannel(Number(id));
    if (kind === 'dca') this.shared.connection.unsubscribeFromDCA(Number(id));
    if (kind === 'mutegroup') this.shared.connection.unsubscribeFromMuteGroup(Number(id));
  }
  subscribeToChannel(id: number) { this.subscribe(`ch_${id}`); }
  subscribeToDCA(id: number) { this.subscribe(`dca_${id}`); }
  subscribeToMuteGroup(id: number) { this.subscribe(`mutegroup_${id}`); }
  unsubscribeFromChannel(id: number) { this.unsubscribe(`ch_${id}`); }
  unsubscribeFromDCA(id: number) { this.unsubscribe(`dca_${id}`); }
  unsubscribeFromMuteGroup(id: number) { this.unsubscribe(`mutegroup_${id}`); }
}
