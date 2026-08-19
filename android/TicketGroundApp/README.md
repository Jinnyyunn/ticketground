# TicketGround Android

Native customer-application foundation for TicketGround. Feature flows remain outside this module until their API contracts are implemented.

## Prerequisites

- Android Studio embedded JDK at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`
- Android SDK with platform 37 and build tools 36.0.0

Do not commit `local.properties`; point the build at a local SDK through `ANDROID_HOME` instead.

## Build and verify

Run commands from this directory:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew assembleDevCustomerDebug --no-daemon
./gradlew testDevCustomerDebugUnitTest --no-daemon
./gradlew lintDevCustomerDebug --no-daemon
```

The build has two flavor dimensions. `environment` (`dev`/`prod`) picks the API origin: `dev` uses `https://dev.ticketground.co.kr` and appends application ID suffix `.dev`; `prod` uses `https://ticketground.co.kr`. `role` (`customer`/`gate`) picks which app this is: `customer` is the ticket-buyer app documented in this file; `gate` is the separate internal admission-scanner app and appends application ID suffix `.gate`. Combine both, e.g. `devCustomerDebug`, `prodCustomerRelease`, `devGateDebug`. Release builds enable R8 and resource shrinking. All variants disable cleartext traffic.

## Security boundary

The app only stores an already-issued bearer credential. `KeystoreSessionVault` uses a non-exportable Android Keystore AES-GCM key and app-private preferences; it does not use `EncryptedSharedPreferences`. Backup and device-transfer extraction are disabled, and the main activity sets `FLAG_SECURE` to prevent screenshots. Credentials must never be added as Gradle constants, resources, or logs.
