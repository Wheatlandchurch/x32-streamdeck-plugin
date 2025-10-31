import streamDeck from "@elgato/streamdeck";

export class ErrorHandler {
  static logError(context: string, error: any, action?: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    streamDeck.logger.error(`[${context}] ${errorMessage}`, error);
    
    if (action) {
      action.showAlert();
    }
  }

  static logWarning(context: string, message: string): void {
    streamDeck.logger.warn(`[${context}] ${message}`);
  }

  static logInfo(context: string, message: string): void {
    streamDeck.logger.info(`[${context}] ${message}`);
  }

  static async handleAsyncError<T>(
    context: string,
    operation: () => Promise<T>,
    action?: any,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.logError(context, error, action);
      return fallback;
    }
  }

  static validateSettings(settings: any, requiredFields: string[]): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!settings[field]) {
        missingFields.push(field);
      }
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  static isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  static isValidPort(port: number): boolean {
    return port >= 1 && port <= 65535;
  }
}

export class ConnectionManager {
  private static connections: Map<string, any> = new Map();

  static getConnection(key: string): any {
    return this.connections.get(key);
  }

  static setConnection(key: string, connection: any): void {
    this.connections.set(key, connection);
  }

  static removeConnection(key: string): void {
    const connection = this.connections.get(key);
    if (connection && typeof connection.disconnect === 'function') {
      connection.disconnect();
    }
    this.connections.delete(key);
  }

  static getConnectionKey(host: string, port: number): string {
    return `${host}:${port}`;
  }

  static async cleanup(): Promise<void> {
    for (const [key, connection] of this.connections) {
      if (connection && typeof connection.disconnect === 'function') {
        try {
          connection.disconnect();
        } catch (error) {
          ErrorHandler.logError("ConnectionManager", `Failed to disconnect ${key}`, error);
        }
      }
    }
    this.connections.clear();
  }
}

export class RetryManager {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    context: string = "operation"
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        ErrorHandler.logWarning(context, `Attempt ${attempt}/${maxRetries} failed: ${error}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 1.5; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }
}

export class ConfigValidator {
  static validateX32Settings(settings: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!settings.x32Host) {
      errors.push("X32 IP address is required");
    } else if (!ErrorHandler.isValidIP(settings.x32Host)) {
      errors.push("Invalid IP address format");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateChannelSettings(settings: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!settings.channel) {
      errors.push("Channel number is required");
    } else if (settings.channel < 1 || settings.channel > 32) {
      errors.push("Channel must be between 1 and 32");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateDCASettings(settings: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!settings.dca) {
      errors.push("DCA number is required");
    } else if (settings.dca < 1 || settings.dca > 8) {
      errors.push("DCA must be between 1 and 8");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateSceneSettings(settings: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!settings.scene) {
      errors.push("Scene number is required");
    } else if (settings.scene < 1 || settings.scene > 100) {
      errors.push("Scene must be between 1 and 100");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}