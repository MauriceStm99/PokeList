# Pokemon Kaufjournal

Ein Pokemon-Kaufjournal mit Backend für persistente Speicherung deiner Käufe.

## Features

- eigene Pokemon-Produkte hinzufügen
- Kaufpreis und Kaufdatum speichern
- Rechnungen als Bild oder PDF anhängen
- Käufe in einer Tabelle anzeigen
- Preisentwicklung als Chart visualisieren
- externe Preishistorien per JSON-URL laden
- persistente Speicherung auf dem Server mit `purchases.json`

## Installation

1. Öffne ein Terminal im Ordner `PokemonList`
2. Installiere die Firebase CLI, falls noch nicht geschehen:
   - `npm install -g firebase-tools`
3. Melde dich an: `firebase login`
4. Erstelle ein Firebase-Projekt in der Firebase-Konsole
5. Kopiere `firebase-config.example.js` nach `firebase-config.js` und trage dort deine Firebase-Projektwerte ein
6. Aktiviere Firestore in deinem Firebase-Projekt

## Lokale Entwicklung

1. Öffne die Datei `firebase-config.js` und überprüfe deine Projektwerte
2. Öffne `index.html` im Browser oder nutze einen lokalen Server

## Firebase Hosting

1. Initialisiere Firebase im Projektordner:
   - `firebase init`
   - Wähle `Hosting` und `Firestore`
   - Wähle `.` als öffentliches Verzeichnis
   - Wähle `Nein`, wenn du nicht möchtest, dass `index.html` überschrieben wird
2. Deploye das Projekt:
   - `firebase deploy --only hosting,firestore`
3. Öffne die bereitgestellte Hosting-URL

## Nutzung

1. Füge im Formular einen Kauf ein.
2. Lade optional eine Rechnung als Bild oder PDF hoch.
3. Der Kauf wird in Firestore gespeichert.
4. Du kannst Käufe löschen und die Preisübersicht bleibt erhalten.

## Externe Preisdaten

Die externe JSON-Datei sollte ein Array im folgenden Format enthalten:

```json
[
  { "date": "2024-01-01", "price": 120.5 },
  { "date": "2024-05-12", "price": 145.0 }
]
```

## Hinweise

- Das Backend speichert Käufe in `purchases.json`.
- Wenn der Server nicht erreichbar ist, verwendet die App ein lokales Browser-Backup.
- Lade die App über `http://localhost:3000`, damit API-Anfragen korrekt funktionieren.
# PokeList
