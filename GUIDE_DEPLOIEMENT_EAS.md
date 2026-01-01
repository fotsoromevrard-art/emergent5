# 🚀 Guide de Déploiement EAS - TPE Crypto

## ✅ Prérequis

1. **Node.js** installé → https://nodejs.org/
2. **Git** installé → https://git-scm.com/downloads
3. **Compte Expo** gratuit → https://expo.dev/signup

---

## 📱 Étapes de Déploiement

### Étape 1 : Cloner le projet

```bash
cd Desktop
git clone https://github.com/fotsoromevrard-art/emergentsh.git
cd emergentsh/frontend
```

### Étape 2 : Installer les dépendances

```bash
npm install
```

### Étape 3 : Installer EAS CLI

```bash
npm install -g eas-cli
```

### Étape 4 : Se connecter à Expo

```bash
eas login
```
> Entrez votre email et mot de passe Expo

### Étape 5 : Configurer le projet EAS

```bash
eas build:configure
```
> Répondez "Y" (Yes) aux questions

### Étape 6 : Générer l'APK

```bash
eas build --platform android --profile preview
```

⏱️ **Attendez 10-20 minutes** - Le build se fait sur les serveurs Expo

### Étape 7 : Télécharger l'APK

Une fois terminé, vous verrez :
```
✔ Build finished
🤖 Android app:
   https://expo.dev/artifacts/eas/xxxxx.apk
```

Cliquez sur le lien pour télécharger l'APK !

---

## 📋 Commandes Résumées

```bash
# Tout en une fois (après avoir installé Git et Node.js)
cd Desktop
git clone https://github.com/fotsoromevrard-art/emergentsh.git
cd emergentsh/frontend
npm install
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

---

## 🔧 Profils de Build Disponibles

| Profil | Commande | Résultat |
|--------|----------|----------|
| **preview** | `eas build --platform android --profile preview` | APK de test |
| **development** | `eas build --platform android --profile development` | APK avec dev tools |
| **production** | `eas build --platform android --profile production` | AAB pour Play Store |

---

## ✅ Ce que l'APK contiendra

- ✅ **Bluetooth BLE** (react-native-ble-plx)
- ✅ **USB** (react-native-usb-serialport)  
- ✅ **Web3/Ethers** (transactions blockchain)
- ✅ **Toutes les permissions Android**
- ✅ **Connexion BSC** (Binance Smart Chain)

---

## 🐛 Dépannage

### "eas: command not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### "Missing Android permissions"
Les permissions sont déjà configurées dans `app.json`.

### Le build échoue
```bash
# Nettoyer et réessayer
rm -rf node_modules
npm install
eas build --platform android --profile preview --clear-cache
```

---

## 📞 Support

- **Expo Discord** : https://chat.expo.dev
- **Documentation EAS** : https://docs.expo.dev/build/introduction/
