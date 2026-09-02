# HARZ Mesh Test Harness — Phone-Only Build Guide

## No laptop needed. Do everything from your phone browser.

## What you need
1. Your GitHub account (rabiuhamza11)
2. Phone browser (Chrome)
3. Two Android phones for testing (after build)

## Steps

### Step 1: Create a new GitHub repo
1. Open https://github.com/new in your phone browser
2. Repository name: harz-mesh-test
3. Set to PUBLIC (GitHub Actions needs public repo for free runners to work without limits)
4. Check "Add a README file"
5. Tap "Create repository"

### Step 2: Upload the files
You need to upload these 4 files to the repo:

1. App.tsx → upload to repo root
2. .github/workflows/build-apk.yml → upload to .github/workflows/ folder
3. package.json → upload to repo root (reference only — the workflow creates the real one)
4. BUILD.md → upload to repo root (reference docs)

To upload from phone:
1. In your repo, tap "Add file" → "Upload files"
2. Tap "choose your files" and select App.tsx from your phone
3. Commit with message "Add App.tsx"
4. Repeat for each file

For the workflow file:
1. Tap "Add file" → "Create new file"
2. Type: .github/workflows/build-apk.yml
3. Paste the contents of build-apk.yml
4. Commit

### Step 3: Trigger the build
1. Go to your repo: https://github.com/rabiuhamza11/harz-mesh-test
2. Tap the "Actions" tab
3. Tap "Build HARZ Mesh Test APK"
4. Tap "Run workflow" → "Run workflow" (green button)
5. Wait 15-25 minutes

### Step 4: Download the APK
1. When the build finishes (green checkmark), tap on the run
2. Scroll down to "Artifacts" section
3. Tap "harz-mesh-test-apk"
4. Download the APK file to your phone

### Step 5: Install on both phones
1. Open the downloaded APK file
2. Android may warn "unknown source" — allow it in Settings
3. Install the app
4. Repeat on the second phone (transfer APK via Bluetooth or share link)

### Step 6: Run the test
Follow the protocol from the test section in BUILD.md:
1. Both phones: Airplane Mode ON
2. Both phones: Re-enable Bluetooth
3. Open the HARZ Mesh app on both
4. Wait for identity + neighbor discovery
5. Tap the neighbor chip to connect
6. Type a message and send
7. Check if it arrives with transport = 'ble'

## If the build fails
1. Tap on the failed run in Actions tab
2. Scroll through the logs
3. The most common issues:
   - SDK version mismatch: check @offline-protocol/mesh-sdk exists on npm
   - Gradle timeout: re-run the workflow (sometimes GitHub runners are slow)
   - Permission error: ensure repo is PUBLIC

## Quick links
- GitHub: https://github.com/rabiuhamza11
- Create repo: https://github.com/new
- Actions after push: https://github.com/rabiuhamza11/harz-mesh-test/actions
