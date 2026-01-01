# 🔧 Guide de Génération de l'APK - TPE Crypto

## ⚠️ IMPORTANT : Expo Go vs Development Build

**Expo Go** (l'application que vous utilisez actuellement) **NE SUPPORTE PAS** les modules natifs comme :
- `react-native-ble-plx` (Bluetooth BLE)
- `react-native-usb-serialport` (USB)

Pour que le **Bluetooth fonctionne réellement**, vous devez générer un **APK personnalisé** (Development Build).

---

## 📱 Option 1 : Build avec EAS (Recommandé - Plus Simple)

### Étape 1 : Installer EAS CLI
```bash
npm install -g eas-cli
```

### Étape 2 : Se connecter à Expo
```bash
eas login
```
> Créez un compte gratuit sur https://expo.dev si vous n'en avez pas

### Étape 3 : Générer l'APK
```bash
cd /app/frontend
eas build --platform android --profile preview
```

### Étape 4 : Télécharger et Installer
- Une fois le build terminé, vous recevrez un lien pour télécharger l'APK
- Installez-le sur votre téléphone Android
- L'APK contiendra tous les modules natifs (Bluetooth, USB)

---

## 🛠️ Option 2 : Build Local (Avancé)

### Prérequis
- Android Studio installé
- JDK 17+
- Variables d'environnement configurées (ANDROID_HOME, JAVA_HOME)

### Étapes
```bash
cd /app/frontend

# 1. Préparer le projet Android
npx expo prebuild --platform android

# 2. Aller dans le dossier Android
cd android

# 3. Builder l'APK Debug
./gradlew assembleDebug

# 4. L'APK sera dans :
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ✅ Vérification après Installation

Après avoir installé l'APK personnalisé :

1. **Ouvrez l'application**
2. **Allez dans Nouveau Paiement**
3. **Sélectionnez "Lecteur de carte (bR301 BLE)"**
4. **Choisissez "Bluetooth BLE"**
5. **L'application devrait maintenant scanner et trouver votre bR301-BLE**

---

## 🐛 Dépannage

### Le lecteur n'est toujours pas détecté

1. **Vérifiez les permissions** :
   - Allez dans Paramètres Android > Applications > TPE Crypto > Permissions
   - Activez : Bluetooth, Localisation

2. **Vérifiez le Bluetooth** :
   - Assurez-vous que le Bluetooth est activé
   - Assurez-vous que la localisation est activée (requis pour BLE sur Android)

3. **Vérifiez le lecteur** :
   - Le bR301-BLE doit être allumé (LED bleue clignotante)
   - Il ne doit pas être connecté à un autre appareil

### Erreur "Permission Denied"

Sur Android 12+, l'application demandera les permissions au premier scan.
Acceptez toutes les permissions demandées.

---

## 📋 Configuration Actuelle

| Élément | Valeur |
|---------|--------|
| Package Android | `com.tpecrypto.app` |
| Version | 1.0.0 |
| Modules Natifs | react-native-ble-plx, expo-location |
| Permissions | BLUETOOTH, BLUETOOTH_SCAN, BLUETOOTH_CONNECT, LOCATION |

---

## 🔗 Liens Utiles

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx)
- [Feitian bR301-BLE](https://www.ftsafe.com/Products/OTP/bR301_Bluetooth)
