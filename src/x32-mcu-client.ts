import { EventEmitter } from 'events';
import * as net from 'net';

export interface X32Config {
  host: string;
  port: number; // Typically 10111 for Mackie MCU
}

/**
 * X32 Mackie MCU Control Client
 * Implements Mackie Control Universal protocol over TCP/IP
 * for Behringer X32 mixer control
 */
export class X32Client extends EventEmitter {
  private socket: net.Socket | null = null;
  private config: X32Config;
  private connected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: X32Config) {
    super();
    this.config = config;
    console.log(`[X32MCU] Creating Mackie MCU client for ${config.host}:${config.port}`);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[X32MCU] Attempting to connect to ${this.config.host}:${this.config.port}`);

      this.socket = new net.Socket();
      
      const timeout = setTimeout(() => {
        console.error('[X32MCU] Connection timeout');
        this.socket?.destroy();
        reject(new Error('Connection timeout - X32 did not respond. Please verify:\n1. X32 IP address is correct\n2. X32 is powered on and connected to network\n3. X32 Remote Protocol is set to "Mackie MCU"\n4. No firewall is blocking TCP port ' + this.config.port));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('[X32MCU] Connected successfully');
        this.connected = true;
        this.emit('connected');
        this.startPing();
        resolve();
      });

      this.socket.on('data', (data: Buffer) => {
        console.log('[X32MCU] Received data:', data.toString('hex'));
        this.handleMidiData(data);
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        console.error('[X32MCU] Socket error:', error);
        this.connected = false;
        this.emit('error', error);
        if (!this.socket || !this.socket.connecting) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('[X32MCU] Connection closed');
        this.connected = false;
        this.emit('disconnected');
        this.stopPing();
      });

      this.socket.connect(this.config.port, this.config.host);
    });
  }

  disconnect(): void {
    console.log('[X32MCU] Disconnecting...');
    this.connected = false;
    this.stopPing();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  private startPing(): void {
    // Send periodic keep-alive messages
    this.pingInterval = setInterval(() => {
      if (this.connected && this.socket) {
        // Send active sensing (0xFE)
        this.sendMidi(Buffer.from([0xFE]));
      }
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendMidi(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      console.log('[X32MCU] Sending MIDI:', data.toString('hex'));
      
      this.socket.write(data as any, (error?: Error) => {
        if (error) {
          console.error('[X32MCU] Error sending MIDI:', error);
          reject(error);
        } else {
          console.log('[X32MCU] MIDI sent successfully');
          resolve();
        }
      });
    });
  }

  private handleMidiData(data: Buffer): void {
    // Parse incoming MIDI messages
    // Mackie Control uses channel pressure (0xD0) and pitch bend (0xE0) for faders
    // Control change (0xB0) for buttons and encoders
    
    for (let i = 0; i < data.length; i++) {
      const status = data[i];
      
      // Channel Pressure (fader position feedback)
      if ((status & 0xF0) === 0xD0) {
        const channel = (status & 0x0F) + 1;
        const value = data[i + 1];
        this.emit('fader', { channel, value });
        i += 1;
      }
      
      // Control Change (button/mute feedback)
      else if ((status & 0xF0) === 0xB0) {
        const controller = data[i + 1];
        const value = data[i + 2];
        
        // Mute buttons are typically CC 16-23 for channels 1-8
        if (controller >= 16 && controller <= 47) {
          const channel = controller - 15;
          const muted = value === 0x01 || value === 0x7F;
          this.emit('mute', { channel, muted });
        }
        
        this.emit('control', { controller, value });
        i += 2;
      }
      
      // Pitch Bend (alternative fader control)
      else if ((status & 0xF0) === 0xE0) {
        const channel = (status & 0x0F) + 1;
        const lsb = data[i + 1];
        const msb = data[i + 2];
        const value = (msb << 7) | lsb;
        this.emit('fader', { channel, value });
        i += 2;
      }
    }
  }

  // Channel control methods for Mackie MCU protocol
  async muteChannel(channel: number, muted: boolean): Promise<void> {
    // MCU mute: Control Change (0xB0 + channel), Controller 16-23, Value 0x00 or 0x7F
    const channelIndex = Math.min(8, channel) - 1; // MCU has 8 channels per bank
    const controller = 16 + channelIndex;
    const value = muted ? 0x7F : 0x00;
    
    const midi = Buffer.from([
      0xB0, // Control Change, channel 1
      controller,
      value
    ]);
    
    await this.sendMidi(midi);
  }

  async setChannelFader(channel: number, level: number): Promise<void> {
    // MCU fader: Pitch Bend (0xE0 + channel), LSB, MSB
    // Level should be 0.0 to 1.0, convert to 14-bit (0-16383)
    const clampedLevel = Math.max(0, Math.min(1, level));
    const midiValue = Math.round(clampedLevel * 16383);
    const lsb = midiValue & 0x7F;
    const msb = (midiValue >> 7) & 0x7F;
    
    const channelIndex = Math.min(8, channel) - 1;
    
    const midi = Buffer.from([
      0xE0 + channelIndex, // Pitch Bend for channel
      lsb,
      msb
    ]);
    
    await this.sendMidi(midi);
  }

  async getChannelMuteStatus(channel: number): Promise<void> {
    // In MCU protocol, we rely on feedback from the mixer
    // No explicit "get" command - mixer sends updates automatically
    console.log(`[X32MCU] Mute status for channel ${channel} will be received via feedback`);
  }

  async getChannelFaderLevel(channel: number): Promise<void> {
    // In MCU protocol, we rely on feedback from the mixer
    console.log(`[X32MCU] Fader level for channel ${channel} will be received via feedback`);
  }

  // DCA control - X32 doesn't directly expose DCAs via Mackie MCU
  // These would need to be mapped to specific channels or auxiliaries
  async muteDCA(dca: number, muted: boolean): Promise<void> {
    console.warn(`[X32MCU] DCA control not directly supported in Mackie MCU protocol`);
    // Could potentially map to aux channels or use SysEx commands
  }

  async setDCAFader(dca: number, level: number): Promise<void> {
    console.warn(`[X32MCU] DCA control not directly supported in Mackie MCU protocol`);
  }

  async getDCAMuteStatus(dca: number): Promise<void> {
    console.warn(`[X32MCU] DCA control not directly supported in Mackie MCU protocol`);
  }

  // Scene control
  async recallScene(scene: number): Promise<void> {
    console.warn(`[X32MCU] Scene recall not directly supported in Mackie MCU protocol`);
    // Would need X32-specific SysEx commands
  }

  async loadScene(scene: number): Promise<void> {
    console.warn(`[X32MCU] Scene loading not directly supported in Mackie MCU protocol`);
  }

  // Mute group control
  async setMuteGroup(muteGroup: number, active: boolean): Promise<void> {
    console.warn(`[X32MCU] Mute group control not directly supported in Mackie MCU protocol`);
  }

  async getMuteGroupState(muteGroup: number): Promise<void> {
    console.warn(`[X32MCU] Mute group state not available in Mackie MCU protocol`);
  }

  // Subscription methods (no-ops for MCU as it provides automatic feedback)
  subscribeToChannel(channel: number): void {
    console.log(`[X32MCU] Channel ${channel} feedback is automatic in MCU protocol`);
  }

  subscribeToDCA(dca: number): void {
    console.log(`[X32MCU] DCA feedback not available in MCU protocol`);
  }

  subscribeToMuteGroup(muteGroup: number): void {
    console.log(`[X32MCU] Mute group feedback not available in MCU protocol`);
  }

  unsubscribeFromChannel(channel: number): void {
    // No-op for MCU
  }

  unsubscribeFromDCA(dca: number): void {
    // No-op for MCU
  }

  unsubscribeFromMuteGroup(muteGroup: number): void {
    // No-op for MCU
  }
}
