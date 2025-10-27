import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { ChannelMuteAction } from "./actions/channel-mute";
import { ChannelFaderAction } from "./actions/channel-fader";
import { SceneRecallAction } from "./actions/scene-recall";
import { DCAControlAction } from "./actions/dca-control";
import { MuteGroupAction } from "./actions/mute-group";
import { ConnectionManager, ErrorHandler } from "./utils";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
streamDeck.actions.registerAction(new ChannelMuteAction());
streamDeck.actions.registerAction(new ChannelFaderAction());
streamDeck.actions.registerAction(new SceneRecallAction());
streamDeck.actions.registerAction(new DCAControlAction());
streamDeck.actions.registerAction(new MuteGroupAction());

// Handle cleanup on plugin termination
process.on('SIGINT', async () => {
  ErrorHandler.logInfo("Plugin", "Shutting down X32 Stream Deck Plugin");
  await ConnectionManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  ErrorHandler.logInfo("Plugin", "Terminating X32 Stream Deck Plugin");
  await ConnectionManager.cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  ErrorHandler.logError("Plugin", "Uncaught exception", error);
  ConnectionManager.cleanup().finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  ErrorHandler.logError("Plugin", `Unhandled rejection at: ${promise} reason: ${reason}`);
});

ErrorHandler.logInfo("Plugin", "Starting X32 Stream Deck Plugin");

// Finally, connect to the Stream Deck.
streamDeck.connect();