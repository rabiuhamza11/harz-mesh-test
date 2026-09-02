# HARZ Mesh BLE Test Harness — Build Guide

## What this is
A minimal React Native app that tests BLE device-to-device messaging using
the @offline-protocol/mesh-sdk v0.24.1. Built for the HARZ Mesh True P2P
Test Protocol (Research 10, Section 6.3).

## Prerequisites
- Node.js 18+
- Android Studio (for Android builds) or Xcode (for iOS)
- Two Android phones with BLE hardware
- USB cables for dev installation (or use `adb install`)

## Build steps

### 1. Create the React Native project
```bash
npx react-native init harzMeshTest --version 0.74.3
cd harzMeshTest
```

### 2. Install the SDK
```bash
npm install @offline-protocol/mesh-sdk@0.24.1
```

### 3. Replace App.tsx
Copy the `App.tsx` from this folder into your project root,
overwriting the generated one.

### 4. Verify SDK types (CRITICAL — do this before building)
Open `node_modules/@offline-protocol/mesh-sdk/lib/types.d.ts` in your
editor and confirm these match what App.tsx uses:

```
TransportsConfig: { ble?: BleTransportConfig, ... }
BleTransportConfig: { enabled: boolean }
MessagePriority: enum { Low=0, Medium=1, High=2, Critical=3 }
ConnectionRequestReceivedEvent: { sender, sender_name, ... }
ConnectionRejectedEvent: { rejected_by, ... }
ConnectionAcceptedEvent: { accepted_by, accepted_by_name, ... }
MessageDeliveredEvent: { latency_ms, transport, ... }
NeighborDiscoveredEvent: { peer_id, transport, rssi, ... }
IdentityReadyEvent: { address, ... }
```

Also confirm `node_modules/@offline-protocol/mesh-sdk/lib/index.d.ts` has:
```
export default OfflineProtocol;
export * from './types';
```

### 5. Android permissions
The SDK's Android manifest should handle BLE permissions, but if the build
complains, add these to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />
```

Android 12+ requires the granular BLUETOOTH_SCAN/CONNECT/ADVERTISE permissions.
ACCESS_FINE_LOCATION is required for BLE scanning on all Android versions.

### 6. Build and install
```bash
# For Android (with phone connected via USB, debugging enabled)
npx react-native run-android

# For iOS (requires Xcode + Apple Developer account)
# Note: SDK uses xcframework — may need pod install
cd ios && pod install && cd ..
npx react-native run-ios
```

### 7. Install on second phone
```bash
# Build the APK
cd android && ./gradlew assembleRelease
# APK will be at android/app/build/outputs/apk/release/app-release.apk
# Transfer to second phone and install
```

## Running the test

### Before starting (per protocol Section 2)
On EACH phone, in this order:
1. Turn on Airplane Mode
2. Re-enable Bluetooth manually
3. Do NOT connect to any WiFi network
4. Verify "No internet connection" in OS settings
5. Place phones 2-3 meters apart

### Test A — Basic delivery
1. Open the app on both phones
2. Wait for "Identity ready" in the log on both
3. Wait for "Neighbor discovered" — both phones should see each other
4. Tap the neighbor chip on Phone 1 — sends connection request
5. Phone 2 auto-accepts — "Connection accepted" appears on Phone 1
6. Type a message on Phone 1 and tap "Send over BLE"
7. Watch Phone 2 — message should arrive with Alert + log entry
8. Check Phone 1 — "Delivery confirmed via ble in Xms ✅"

### Test B — Confirm no internet path
1. After Test A, check the "Active transports" line at top — must show ['ble']
2. Check the delivery log — transport must be 'ble' (✅ flag)
3. Watch for any "⚠️ Transport switched" events — if any appear with
   `to: 'internet'`, the test is compromised
4. Re-confirm Airplane Mode is still on after the message arrives

### Test C — Range and reliability
1. Tap "Pull diagnostics" after each test for metrics
2. Repeat Test A at 5m, 10m, through-a-wall
3. Repeat 3-5 times at a fixed distance for consistency
4. Key metrics: delivery success rate, median latency, RSSI, error rate

## WiFi Direct — NOT TESTABLE
The SDK's WifiDirectTransport is never registered with the transport
manager. Frames are dropped. This is an SDK-level limitation, not a
bug in the test harness. Marked as "not testable — SDK limitation"
in the test protocol.

## Known gaps
- The `import Protocol, { MessagePriority }` line assumes the SDK's
  default export is the OfflineProtocol class and MessagePriority is
  re-exported. Verified against v0.24.1 .d.ts — but if the import fails,
  try: `import { OfflineProtocol, MessagePriority } from '@offline-protocol/mesh-sdk'`
- `getBLePeerCount()` has a typo (BLe, not Ble) — this is in the SDK
  itself, not our code. Verified in the actual .d.ts.
- The `any` casts on event payloads mean TypeScript can't catch field
  name mismatches at compile time. For the production HARZ Mesh app,
  replace `any` with the SDK's real event interfaces for type safety.

## License note
The SDK is dual-licensed: AGPL-3.0 (free, strong copyleft) or Commercial
License from Offline Protocol, Inc. AGPL is fine for research testing.
For shipping in a proprietary HARZ app (especially iOS App Store), you
need the commercial license.
