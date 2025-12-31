# 📱 TPE Crypto - Guide d'intégration Feitian bR301-BLE

## 🎯 Vue d'ensemble

Cette application est un Terminal de Paiement Électronique (TPE) qui supporte :
- **Paiements Crypto** : Via liens Metamask (XAF, EUROM, TND sur BSC)
- **Paiements Carte à Puce** : Via lecteur Feitian bR301-BLE (Bluetooth & USB-C)

## 📋 État actuel de l'intégration bR301-BLE

### ✅ Ce qui est implémenté

1. **Service Bluetooth (`br301BleService.ts`)**
   - Scan des devices BLE avec `react-native-ble-plx`
   - Connexion au lecteur bR301-BLE
   - Découverte automatique des services et caractéristiques
   - Envoi et réception de commandes APDU
   - Surveillance de l'insertion/retrait de carte
   - Mode simulation pour le web (preview)

2. **Service USB (`br301UsbService.ts`)**
   - Détection automatique des devices USB
   - Connexion via `react-native-usb-serialport`
   - Communication série avec le lecteur
   - Mode simulation pour le web

3. **Vérifications de plateforme (`platformService.ts`)**
   - Détection automatique web/Android/iOS
   - Messages d'avertissement appropriés
   - Gestion gracieuse des fonctionnalités non disponibles

4. **Écran de paiement (`paiement-carte-br301.tsx`)**
   - Interface complète pour le flux de paiement
   - Choix du mode de connexion (BLE/USB)
   - Affichage des lecteurs détectés
   - États visuels clairs (connexion, attente carte, traitement)

### ⚙️ Configuration `app.json`

```json
{
  "android": {
    "permissions": [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.USB_PERMISSION"
    ]
  },
  "plugins": [
    ["react-native-ble-plx", {
      "isBackgroundEnabled": false,
      "modes": ["peripheral", "central"]
    }]
  ]
}
```

## 🔧 Pour générer l'APK de test

### Option 1 : EAS Build (Recommandé)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Connexion Expo
eas login

# Créer un build de développement
eas build --platform android --profile development

# Ou un build preview (APK direct)
eas build --platform android --profile preview
```

### Option 2 : Build local

```bash
# Préparer le projet
npx expo prebuild --platform android

# Builder avec Gradle
cd android
./gradlew assembleDebug

# L'APK sera dans android/app/build/outputs/apk/debug/
```

## 🧪 Test sur appareil réel

### Prérequis
1. Un téléphone Android avec Bluetooth activé
2. Le lecteur Feitian bR301-BLE allumé
3. Une carte à puce JCOP/JavaCard

### Étapes de test

1. **Installer l'APK** sur votre appareil Android
2. **Activer le Bluetooth** et la localisation
3. **Ouvrir l'application** et configurer le wallet marchand
4. **Nouveau Paiement** → Sélectionner devise → Entrer montant
5. **Carte à puce (bR301-BLE)** → Choisir Bluetooth ou USB
6. **Scanner** : L'app va chercher les lecteurs à proximité
7. **Connecter** : Sélectionner votre bR301-BLE dans la liste
8. **Insérer la carte** quand demandé
9. **Paiement** : Le flux APDU s'exécute automatiquement

## 📡 UUIDs Bluetooth bR301-BLE

Les UUIDs exacts dépendent de votre version du firmware. Le service les découvre automatiquement lors de la connexion. Voici les valeurs typiques :

```typescript
// Service CCID standard
SERVICE_UUID: '0000fff0-0000-1000-8000-00805f9b34fb'
WRITE_CHAR:   '0000fff1-0000-1000-8000-00805f9b34fb'
READ_CHAR:    '0000fff2-0000-1000-8000-00805f9b34fb'
NOTIFY_CHAR:  '0000fff3-0000-1000-8000-00805f9b34fb'
```

> 💡 **Conseil** : Au premier test, vérifiez les logs de l'application pour voir les UUIDs réels découverts.

## 🔄 Commandes APDU supportées

Le service utilise des commandes CCID standard :

| Commande | Description |
|----------|-------------|
| `GET SLOT STATUS` | Vérifier présence de carte |
| `POWER ON ICC` | Activer la carte et obtenir ATR |
| `XFR BLOCK` | Transférer données APDU |
| `POWER OFF ICC` | Désactiver la carte |

## ⚠️ Limitations actuelles

1. **Preview Web** : Les fonctionnalités hardware sont simulées
2. **iOS** : USB non supporté (limitation système)
3. **Expo Go** : Nécessite un build de développement (EAS)

## 📁 Structure des fichiers

```
frontend/
├── app/
│   └── paiement-carte-br301.tsx  # Écran principal
├── services/
│   ├── br301BleService.ts        # Service Bluetooth
│   ├── br301UsbService.ts        # Service USB
│   └── platformService.ts        # Détection plateforme
└── config/
    └── br301Config.ts            # Configuration lecteur
```

## 🐛 Dépannage

### Le lecteur n'est pas détecté

1. Vérifiez que le bR301-BLE est allumé (LED bleue clignotante)
2. Assurez-vous que le Bluetooth est activé
3. Accordez les permissions de localisation à l'application
4. Rapprochez-vous du lecteur (< 3 mètres)

### Erreur de connexion

1. Essayez d'éteindre et rallumer le lecteur
2. Désactivez/réactivez le Bluetooth du téléphone
3. Vérifiez qu'aucune autre application n'utilise le lecteur

### La carte n'est pas détectée

1. Vérifiez que la carte est bien insérée (contacts vers le haut)
2. Nettoyez les contacts de la carte
3. Essayez avec une autre carte JCOP

## 📞 Support

Pour toute question technique, consultez la documentation Feitian :
- [Feitian bR301-BLE Datasheet](https://www.ftsafe.com/)
- [CCID Specification](https://www.usb.org/ccid)
