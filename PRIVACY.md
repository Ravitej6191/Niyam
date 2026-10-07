# Niyam — Privacy

This describes what the app does with data, for use as the basis of a published privacy
policy (Google Play requires a hosted policy URL).

## Data you create
Habits, expenses, notes, counters, focus/breathing sessions, moods, journal logs,
reminders and profile/settings.

- **Guest mode:** stored only on your device (WebView local storage).
- **Signed in with Google:** also stored in Google Firebase (Cloud Firestore) under your
  account id, so it syncs across devices. Only you can read it (see `firestore.rules`).
- "Clear All Data" in Account deletes the cloud copy and the on-device copy.

## App lock
The PIN is kept on the device as a salted hash, and the optional biometric lock uses the
Android system prompt. Neither is sent anywhere. Note passwords are stored the same way.
Note text itself is not encrypted at rest.

## Location (Home screen weather)
If you grant **approximate location**, the app sends your coordinates, rounded to about 1 km,
to two third-party services to show temperature and city name:

- **Open-Meteo** (`api.open-meteo.com`) — weather
- **OpenStreetMap Nominatim** (`nominatim.openstreetmap.org`) — city name

Nothing is stored by Niyam beyond a 10-minute in-memory cache. Denying the permission only
hides the weather.

## Not collected
No ads, no analytics SDKs, no tracking identifiers.
