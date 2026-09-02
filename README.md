# HARZ Mesh BLE Sovereignty Test

Tests whether two Android phones can exchange messages over BLE with zero internet connectivity using @offline-protocol/mesh-sdk v0.24.1.

## Files
- `App.tsx` — React Native test harness (all SDK bugs corrected)
- `.github/workflows/build-apk.yml` — GitHub Actions workflow that builds the APK
- `BUILD.md` — Full build guide + test protocol
- `PHONE-BUILD-GUIDE.md` — Step-by-step for building from phone only
- `AndroidManifest.permissions.xml` — BLE permission snippets
- `package.json` — Dependency references

## Build
The GitHub Actions workflow automatically builds a debug APK when you push to main/master, or you can trigger it manually from the Actions tab.

## License
SDK: AGPL-3.0 / Commercial (Offline Protocol, Inc.)
Test harness: HARZ Digital Services

