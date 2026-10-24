# Teli Garment Gateway

Independent copy of the school gateway, owned by this billing repository.
The original TeliGateway source is unchanged. Android package:
`in.telisoftware.garmentgateway`; app code: `GARMENTERP`.

## Connection

Enter the separate Billing SMS HTTPS URL, shop code and single-use pairing code.
No TeliCampus login or endpoint is used. The Billing SMS service generates pairing
codes after authenticating the shop. Codes expire in 10 minutes.

## Build

Run `npm ci`, `npm run build`, `npm run android:sync`, then
`android/gradlew.bat assembleDebug` with the Android SDK and Java installed.
Install the generated APK separately from the original TeliGateway.

The foreground sender needs internet, SMS permission and an active SIM.
SUBMITTED means Android accepted the submission call, not delivered to recipient.
Uncertain submissions are held for review instead of automatic resend.
Real SIM operation and Android background behavior require testing on a phone.
