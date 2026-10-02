# X32 Edit synchronization fix

The plugin previously opened a UDP socket for each action type. With channel
mute, fader, DCA, mute group and scene actions configured, the plugin could
register five remote clients on one mixer. The X32 only sends parameter updates
to four active `/xremote` clients. X32 Edit could therefore lose updates even
though Stream Deck commands still changed the mixer and polling still worked.

All action clients and connection tests now share one UDP connection per host
and port. Concurrent connection attempts share one handshake. Subscriptions
remain active until their last action user releases them, and closing one
client does not close other actions' connection. Keep-alive renewal runs every
five seconds, with timers stopped when the last client disconnects. Failed
connection attempts release their client resources. Scene actions reuse their
connections per mixer instead of creating a new one on each appearance.

Channel and DCA faders now always use OSC float tags, including exactly zero
and one. Mutes and scene indices retain integer tags.

## Verification

Run `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build`.
The UDP regression test models a mixer's four remote slots with an editor
client and five plugin clients. It checks editor broadcasts, updates to all
plugin clients, concurrent connection setup, shared subscription ownership,
disconnect isolation, endpoint isolation and fader packet types.

For hardware acceptance, install the rebuilt plugin, restart Stream Deck to
remove old sockets, connect X32 Edit and configure all five action types for
the same mixer. Toggle channel mute, DCA mute and mute groups; rotate a fader
through its endpoints and recall a scene. Confirm both the console and X32
Edit show every change. Change levels and mutes in X32 Edit and on the console
and confirm Stream Deck feedback follows. Repeat after more than ten seconds,
after switching Stream Deck pages, and after a connection test. Other remote
apps still count toward the mixer's four-client limit.

Protocol reference: [Patrick-Gilles Maillot's X32/M32 OSC protocol, page 9](https://x32ram.com/wp-content/uploads/download-files/X32-OSC.pdf).

This folder is a source export without `.git` metadata. Hardware acceptance
requires an actual X32 and X32 Edit; automated tests use a UDP simulator.
