/**
 * HARZ Mesh — BLE P2P Test Harness (v2.1, corrected against SDK v0.24.1 audit)
 *
 * All four bug fixes from the verification rounds applied:
 *  1. Transport names lowercase: 'ble' not 'BLE', 'wifiDirect' not 'WIFI_DIRECT'
 *  2. Connection-request handshake before sendMessage (required with encryption)
 *  3. Event payload field names match SDK .d.ts exactly:
 *     - sender_name (snake_case) not senderName
 *     - rejected_by not peer
 *     - accepted_by for ConnectionAcceptedEvent
 *  4. MessagePriority.High enum import (not invalid string 'normal')
 *  5. TransportsConfig is an object {ble: {enabled: true}}, not an array
 *
 * Verified against real @offline-protocol/mesh-sdk v0.24.1 .d.ts files.
 * Before building: visually confirm node_modules/@offline-protocol/mesh-sdk/lib/types.d.ts
 * matches the field names used here. Cheap insurance against a 5th bug.
 *
 * WiFi Direct intentionally excluded — SDK's WifiDirectTransport is never
 * registered with the transport manager (frames dropped). Marked as
 * "not testable — SDK limitation" in the test protocol, not as pending.
 *
 * Dark theme is intentional for this field-testing tool (outdoor legibility).
 * Production HARZ Mesh product must use light theme (#f0f2f5) per standing order.
 */
import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
} from 'react-native';

// SDK default export is OfflineProtocol class; MessagePriority is a named
// export re-exported from './types' via `export * from './types'` in index.
import Protocol, {MessagePriority} from '@offline-protocol/mesh-sdk';

type LogEntry = {time: string; message: string};
type Neighbor = {peerId: string; transport: string; rssi?: number};

// TransportsConfig is an object with per-transport config objects, NOT an
// array of strings. BleTransportConfig = { enabled: boolean }.
const TRANSPORTS_CONFIG = {ble: {enabled: true}};

export default function App(): React.JSX.Element {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [selectedPeer, setSelectedPeer] = useState('');
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [activeTransports, setActiveTransports] = useState<string[]>([]);

  const protocolRef = useRef<any>(null);

  const appendLog = useCallback((message: string) => {
    setLog(prev => [
      {time: new Date().toISOString().split('T')[1].slice(0, 12), message},
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        appendLog('Creating protocol instance...');

        // EncryptionConfig supports `autoKeyExchange?: boolean`.
        // With it true, the SDK may skip the manual connection-request
        // handshake entirely. Worth testing both configurations:
        //   Run 1: encryption: {enabled: true, autoKeyExchange: true}
        //     — try sendMessage directly after neighbor_discovered, skip
        //     connectToPeer(). If it works, the handshake below is
        //     unnecessary complexity.
        //   Run 2 (current default below): autoKeyExchange left unset
        //     — full manual handshake path, closer to the DPB-1 original.
        // Currently wired for Run 2, since the handshake is a strict
        // superset (works whether or not auto exchange is also active).
        const protocol = new (Protocol as any)({
          appId: 'harz-mesh-test-harness',
          profile: 'test',
          transports: TRANSPORTS_CONFIG,
          encryption: {enabled: true},
        });
        protocolRef.current = protocol;

        // ─── Identity ───
        // IdentityReadyEvent: { type: 'identity_ready', address: string }
        protocol.on('identity_ready', ({address}: {address: string}) => {
          if (!mounted) return;
          setMyAddress(address);
          appendLog(`Identity ready: ${address}`);
        });

        // ─── Peer Discovery ───
        // NeighborDiscoveredEvent: { type: 'neighbor_discovered', peer_id: string, transport: string, rssi?: number }
        protocol.on(
          'neighbor_discovered',
          ({peer_id, transport, rssi}: any) => {
            appendLog(
              `Neighbor discovered: ${peer_id} via ${transport}${
                rssi ? ` (rssi ${rssi})` : ''
              }`,
            );
            setNeighbors(prev =>
              prev.some(n => n.peerId === peer_id)
                ? prev
                : [...prev, {peerId: peer_id, transport, rssi}],
            );
          },
        );

        // NeighborLostEvent: { type: 'neighbor_lost', peer_id: string }
        protocol.on('neighbor_lost', ({peer_id}: any) => {
          appendLog(`Neighbor lost: ${peer_id}`);
          setNeighbors(prev => prev.filter(n => n.peerId !== peer_id));
        });

        // ─── Connection Handshake ───
        // ConnectionRequestReceivedEvent: { type: 'connection_request_received', sender: string, sender_name: string, timestamp: number, key_package?: number[], initial_message?: string }
        protocol.on(
          'connection_request_received',
          ({sender, sender_name}: any) => {
            appendLog(
              `Connection request from ${sender} (${sender_name ?? 'unknown'}) — auto-accepting (trusted test device).`,
            );
            protocol.acceptConnectionRequest({
              recipient: sender,
              accepterName: 'harz-test-harness',
            });
          },
        );

        // ConnectionAcceptedEvent: { type: 'connection_accepted', accepted_by: string, accepted_by_name: string, timestamp: number, key_package?: number[] }
        protocol.on('connection_accepted', ({accepted_by, accepted_by_name}: any) => {
          appendLog(
            `Connection accepted by ${accepted_by} (${accepted_by_name ?? 'unnamed'})`,
          );
          setConnectedPeers(prev =>
            prev.includes(accepted_by) ? prev : [...prev, accepted_by],
          );
        });

        // ConnectionRejectedEvent: { type: 'connection_rejected', rejected_by: string }
        protocol.on('connection_rejected', ({rejected_by}: any) => {
          appendLog(`Connection rejected by ${rejected_by}`);
        });

        // ─── Messaging ───
        // MessageReceivedEvent: { type: 'message_received', message_id: string, sender: string, recipient: string, content: string, hop_count: number, transport: string, timestamp: number, ... }
        protocol.on('message_received', (msg: any) => {
          appendLog(
            `RECEIVED from ${msg.sender} via ${msg.transport} (hops: ${msg.hop_count ?? 0}): "${msg.content}"`,
          );
          Alert.alert(
            'Message received',
            `From ${msg.sender} via ${msg.transport}:\n${msg.content}`,
          );
        });

        // MessageDeliveredEvent: { type: 'message_delivered', message_id: string, latency_ms: number, hop_count: number, transport: string }
        // latency_ms = Test A evidence (time-to-delivery)
        // transport = Test B evidence (must be 'ble' for sovereignty pass)
        protocol.on('message_delivered', ({latency_ms, transport, ...rest}: any) => {
          const bleFlag = transport === 'ble'
            ? '✅'
            : '⚠️ NOT BLE — Test B validity at risk';
          appendLog(
            `Delivery confirmed via ${transport} in ${latency_ms}ms ${bleFlag} ${JSON.stringify(rest)}`,
          );
        });

        protocol.on('message_failed', (info: any) => {
          appendLog(`Delivery FAILED: ${JSON.stringify(info)}`);
        });
        protocol.on('message_relayed', (info: any) => {
          appendLog(`Message relayed: ${JSON.stringify(info)}`);
        });
        protocol.on('message_deferred', (info: any) => {
          appendLog(
            `Message deferred (store-and-forward): ${JSON.stringify(info)}`,
          );
        });

        // TransportSwitchedEvent: { type: 'transport_switched', from: string | null, to: string, reason: string }
        // If this fires during the sovereignty test with `to` !== 'ble',
        // it means a fallback transport was used — invalidates Test B pass.
        protocol.on('transport_switched', (info: any) => {
          appendLog(
            `⚠️ Transport switched: ${JSON.stringify(info)} — check this doesn't indicate a fallback to internet during the sovereignty test.`,
          );
        });

        // ─── Startup ───
        appendLog('Checking Bluetooth hardware state...');
        const bleEnabled = await protocol.isBluetoothEnabled();
        if (!bleEnabled) {
          appendLog('Bluetooth disabled — requesting enable...');
          await protocol.requestEnableBluetooth();
        }

        await protocol.start();
        appendLog('Protocol started.');

        // Lock to BLE only — prevents any fallback to internet transport.
        // This is the runtime enforcement of the sovereignty test condition.
        await protocol.forceTransport('ble');
        appendLog("Forced transport lock: 'ble' only.");

        // Verify only BLE is active — this is Test B evidence displayed live.
        const active = await protocol.getActiveTransports();
        setActiveTransports(active);
        appendLog(
          `Active transports (should be ['ble'] only): ${JSON.stringify(active)}`,
        );
      } catch (err) {
        appendLog(`Init failed: ${(err as Error).message}`);
      }
    })();

    return () => {
      mounted = false;
      protocolRef.current?.releaseTransportLock?.();
      protocolRef.current?.stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectToPeer = useCallback(
    async (peerId: string) => {
      const protocol = protocolRef.current;
      if (!protocol) return;
      appendLog(`Sending connection request to ${peerId}...`);
      try {
        // SendConnectionRequestParams: { recipient: string, senderName: string, keyPackage?: number[], initialMessage?: string }
        await protocol.sendConnectionRequest({
          recipient: peerId,
          senderName: 'harz-test-harness',
        });
      } catch (err) {
        appendLog(`Connection request failed: ${(err as Error).message}`);
      }
    },
    [appendLog],
  );

  const sendMessage = useCallback(async () => {
    const protocol = protocolRef.current;
    if (!protocol || !selectedPeer || !messageText) {
      appendLog(
        'Cannot send: missing protocol, selected peer, or message text.',
      );
      return;
    }
    if (!connectedPeers.includes(selectedPeer)) {
      appendLog(
        `Not yet connected to ${selectedPeer} — send a connection request first.`,
      );
      return;
    }
    try {
      appendLog(`Sending to ${selectedPeer}: "${messageText}"`);
      // SendMessageParams: { recipient: string, content: string, priority?: MessagePriority, ... }
      // MessagePriority is a numeric enum: Low=0, Medium=1, High=2, Critical=3
      // No string values exist — 'normal' would silently fail.
      const result = await protocol.sendMessage({
        recipient: selectedPeer,
        content: messageText,
        priority: MessagePriority.High,
      });
      appendLog(`sendMessage() returned: ${JSON.stringify(result)}`);
    } catch (err) {
      appendLog(`Send failed: ${(err as Error).message}`);
    }
  }, [selectedPeer, messageText, connectedPeers, appendLog]);

  const pullDiagnostics = useCallback(async () => {
    const protocol = protocolRef.current;
    if (!protocol) return;
    try {
      // NOTE: getBLePeerCount has a typo in the SDK (BLe, not Ble).
      // Verified in the actual .d.ts: getBLePeerCount(): Promise<number>
      const peerCount = await protocol.getBLePeerCount();
      const diagnostics = await protocol.getBleDiagnostics();
      const metrics = await protocol.getTransportMetrics('ble');
      const topology = await protocol.getTopology();
      const stats = await protocol.getMessageStats();

      appendLog(`BLE peer count: ${peerCount}`);
      appendLog(`BLE diagnostics: ${JSON.stringify(diagnostics)}`);
      appendLog(`BLE metrics (Test C evidence): ${JSON.stringify(metrics)}`);
      appendLog(`Topology: ${JSON.stringify(topology)}`);
      appendLog(`Message stats: ${JSON.stringify(stats)}`);

      // Extra: delivery success rate and latency for Test C summary
      const successRate = await protocol.getDeliverySuccessRate();
      const medianLatency = await protocol.getMedianLatency();
      const medianHops = await protocol.getMedianHops();
      appendLog(
        `Delivery success rate: ${(successRate * 100).toFixed(1)}% | Median latency: ${medianLatency ?? 'N/A'}ms | Median hops: ${medianHops ?? 'N/A'}`,
      );
    } catch (err) {
      appendLog(`Diagnostics pull failed: ${(err as Error).message}`);
    }
  }, [appendLog]);

  const exportLog = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportText = log
      .map(entry => `[${entry.time}] ${entry.message}`)
      .join('\n');
    const fullExport = `HARZ Mesh BLE Sovereignty Test Log\nExported: ${new Date().toISOString()}\nAddress: ${myAddress ?? 'N/A'}\nActive transports: ${JSON.stringify(activeTransports)}\n\n${exportText}`;

    // Use Share API so the log can be sent to WhatsApp/Telegram for evidence
    // import { Share } from 'react-native' at top if you want to use this
    // For now, log it so it can be screenshotted
    appendLog(`Log export ready (${log.length} entries) — screenshot this screen for evidence.`);
    console.log(fullExport);
  }, [log, myAddress, activeTransports, appendLog]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>HARZ Mesh — BLE Sovereignty Test</Text>
      <Text style={styles.subheader}>
        My address: {myAddress ?? '(initializing...)'}
      </Text>
      <Text style={styles.subheader}>
        Active transports: {JSON.stringify(activeTransports)}{' '}
        {activeTransports.length === 1 && activeTransports[0] === 'ble'
          ? '✅ BLE-only confirmed'
          : '⚠️ check this'}
      </Text>

      <Text style={styles.sectionLabel}>
        Discovered neighbors ({neighbors.length})
      </Text>
      <ScrollView horizontal style={styles.peerRow}>
        {neighbors.map(n => (
          <TouchableOpacity
            key={n.peerId}
            style={[
              styles.peerChip,
              connectedPeers.includes(n.peerId) && styles.peerChipConnected,
            ]}
            onPress={() => {
              setSelectedPeer(n.peerId);
              if (!connectedPeers.includes(n.peerId)) {
                connectToPeer(n.peerId);
              }
            }}>
            <Text style={styles.peerChipText}>
              {n.peerId.slice(0, 10)}... ({n.transport})
              {connectedPeers.includes(n.peerId) ? ' ✓' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        style={styles.input}
        placeholder="Selected peer ID"
        value={selectedPeer}
        onChangeText={setSelectedPeer}
        placeholderTextColor="#555"
      />
      <TextInput
        style={styles.input}
        placeholder="Message text"
        value={messageText}
        onChangeText={setMessageText}
        placeholderTextColor="#555"
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send over BLE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.diagButton} onPress={pullDiagnostics}>
          <Text style={styles.sendButtonText}>Pull diagnostics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={exportLog}>
          <Text style={styles.sendButtonText}>Export log</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Log</Text>
      <ScrollView style={styles.log}>
        {log.map((entry, i) => (
          <Text key={i} style={styles.logLine}>
            [{entry.time}] {entry.message}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, backgroundColor: '#0b0f14'},
  header: {fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4},
  subheader: {fontSize: 12, color: '#8aa', marginBottom: 4},
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9cf',
    marginTop: 12,
    marginBottom: 6,
  },
  peerRow: {maxHeight: 40, marginBottom: 8},
  peerChip: {
    backgroundColor: '#1c2733',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  peerChipConnected: {backgroundColor: '#1e4d2b'},
  peerChipText: {color: '#9cf', fontSize: 12},
  input: {
    backgroundColor: '#1c2733',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  buttonRow: {flexDirection: 'row', gap: 8},
  sendButton: {
    flex: 1,
    backgroundColor: '#2b6cff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  diagButton: {
    flex: 1,
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  sendButtonText: {color: '#fff', fontWeight: '600'},
  log: {
    flex: 1,
    backgroundColor: '#05080b',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  logLine: {
    color: '#7f9',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
