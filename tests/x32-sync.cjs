const { test } = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const { once } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/x32-client.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { X32Client } = compiled.exports;

function message(address, value) {
  const str = text => { const b = Buffer.from(text + '\0'); return Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4)]); };
  const n = Buffer.alloc(4); n.writeInt32BE(value);
  return Buffer.concat([str(address), str(',i'), n]);
}

test('five action clients preserve editor broadcasts, shared polling and connection lifetime', { timeout: 10000 }, async () => {
  const mixer = dgram.createSocket('udp4');
  const editor = dgram.createSocket('udp4');
  const clients = [];
  const remotes = new Map();
  const packets = [];
  try {
    mixer.bind(0, '127.0.0.1'); await once(mixer, 'listening');
    editor.bind(0, '127.0.0.1'); await once(editor, 'listening');
    mixer.on('message', (packet, peer) => {
      const address = packet.toString('utf8', 0, packet.indexOf(0));
      packets.push({ address, packet, port: peer.port });
      if (address === '/xremote') {
        remotes.set(peer.port, peer);
        // Model the X32's four active remote slots.
        if (remotes.size > 4) remotes.delete(remotes.keys().next().value);
      } else if (address === '/ch/01/mix/on') {
        const offset = Math.ceil((packet.indexOf(0) + 1) / 4) * 4;
        if (packet[offset + 1] === 0) {
          mixer.send(message(address, 1), peer.port, peer.address);
        } else {
          for (const remote of remotes.values()) mixer.send(packet, remote.port, remote.address);
        }
      }
    });
    editor.send(Buffer.from('/xremote\0\0\0\0,\0\0\0'), mixer.address().port, '127.0.0.1');
    for (let i = 0; i < 5; i++) clients.push(new X32Client({ host: '127.0.0.1', port: mixer.address().port }));
    await Promise.all(clients.map(client => client.connect()));
    assert.equal(remotes.size, 2, 'editor plus only one plugin endpoint');
    assert.equal(new Set(packets.filter(p => p.address === '/xremote').map(p => p.port)).size, 2);
    const editorUpdate = once(editor, 'message');
    const actionUpdates = clients.map(client => once(client, 'message:/ch/01/mix/on'));
    await clients[0].muteChannel(1, true);
    assert.equal((await editorUpdate)[0].readInt32BE(message('/ch/01/mix/on', 0).length - 4), 0);
    await Promise.all(actionUpdates);
    clients[0].subscribeToChannel(1);
    clients[1].subscribeToChannel(1);
    clients[0].unsubscribeFromChannel(1);
    const polled = once(clients[1], 'message:/ch/01/mix/on');
    clients[0].disconnect(); clients[0].disconnect();
    await polled;
    assert.equal(clients[1].isConnected(), true);
    for (const level of [0, 1, 0.75]) {
      await clients[1].setChannelFader(1, level);
      await clients[1].setDCAFader(1, level);
    }
    // A subsequent query ensures all earlier datagrams have reached the mixer.
    const barrier = once(clients[1], 'message:/ch/01/mix/on');
    await clients[1].getChannelMuteStatus(1); await barrier;
    const faders = packets.filter(p => p.address.endsWith('/fader') &&
      p.packet[Math.ceil((p.packet.indexOf(0) + 1) / 4) * 4 + 1] === 0x66);
    assert.equal(faders.length, 6);
    for (const { packet } of faders) {
      const offset = Math.ceil((packet.indexOf(0) + 1) / 4) * 4;
      assert.equal(packet.toString('utf8', offset, offset + 2), ',f');
      assert.ok([0, 1, 0.75].includes(packet.readFloatBE(packet.length - 4)));
    }
    const other = new X32Client({ host: '127.0.0.1', port: mixer.address().port + 1 });
    clients.push(other);
    assert.equal(other.isConnected(), false, 'different mixer endpoints have isolated connection state');
  } finally {
    clients.forEach(client => client.disconnect());
    editor.close(); mixer.close();
  }
});
