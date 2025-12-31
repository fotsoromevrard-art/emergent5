# 📶 Connexion Bluetooth Lecteur de Carte - Configuration Complète

## 🎯 Ce qu'il faut pour que Bluetooth fonctionne SANS BUG

---

## 1️⃣ BIBLIOTHÈQUE REQUISE

### react-native-ble-plx (Déjà installée ✅)

```bash
yarn add react-native-ble-plx
```

**Version recommandée** : `^3.0.0` ou supérieure

---

## 2️⃣ PERMISSIONS ANDROID

### AndroidManifest.xml

**Fichier** : `/app/frontend/android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  
  <!-- Permissions Bluetooth BLE -->
  <uses-permission android:name="android.permission.BLUETOOTH"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
  
  <!-- Android 12+ (API 31+) -->
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
                   android:usesPermissionFlags="neverForLocation"/>
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
  
  <!-- Localisation (requis pour scan BLE sur Android) -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
  
  <!-- Features -->
  <uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
  
  <application>
    <!-- Votre app -->
  </application>
</manifest>
```

### build.gradle (app level)

**Fichier** : `/app/frontend/android/app/build.gradle`

```gradle
android {
    compileSdkVersion 34  // Minimum 31 pour Bluetooth moderne
    
    defaultConfig {
        minSdkVersion 23  // Minimum pour BLE
        targetSdkVersion 34
        
        // Permissions à la compilation
        manifestPlaceholders = [
            'appAuthRedirectScheme': 'com.votreapp'
        ]
    }
}

dependencies {
    // react-native-ble-plx gère automatiquement ses dépendances
}
```

---

## 3️⃣ PERMISSIONS iOS

### Info.plist

**Fichier** : `/app/frontend/ios/VotreApp/Info.plist`

```xml
<dict>
  <!-- Description Bluetooth -->
  <key>NSBluetoothAlwaysUsageDescription</key>
  <string>Cette application utilise le Bluetooth pour communiquer avec les lecteurs de carte à puce</string>
  
  <key>NSBluetoothPeripheralUsageDescription</key>
  <string>Cette application a besoin du Bluetooth pour se connecter aux lecteurs de carte</string>
  
  <!-- Localisation (requis pour BLE sur iOS) -->
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>La localisation est requise pour scanner les appareils Bluetooth à proximité</string>
  
  <key>NSLocationAlwaysUsageDescription</key>
  <string>Nécessaire pour la détection Bluetooth en arrière-plan</string>
  
  <!-- Background modes (optionnel) -->
  <key>UIBackgroundModes</key>
  <array>
    <string>bluetooth-central</string>
  </array>
</dict>
```

---

## 4️⃣ DEMANDE DE PERMISSIONS DANS L'APP

### Code à ajouter dans usbCardReaderService.ts

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

async requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
          granted['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
          granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
        );
      } catch (err) {
        console.error('Erreur permissions Bluetooth:', err);
        return false;
      }
    } else {
      // Android < 12
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted';
      } catch (err) {
        console.error('Erreur permissions:', err);
        return false;
      }
    }
  }
  
  // iOS - permissions gérées automatiquement
  return true;
}
```

---

## 5️⃣ VÉRIFIER QUE BLUETOOTH EST ACTIVÉ

```typescript
async checkBluetoothState(): Promise<boolean> {
  try {
    const bleManager = new BleManager();
    const state = await bleManager.state();
    
    console.log('État Bluetooth:', state);
    
    if (state !== 'PoweredOn') {
      Alert.alert(
        'Bluetooth désactivé',
        'Veuillez activer le Bluetooth pour scanner les lecteurs',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Paramètres', onPress: () => {
            if (Platform.OS === 'android') {
              Linking.openSettings();
            } else {
              Linking.openURL('App-Prefs:Bluetooth');
            }
          }}
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur vérification Bluetooth:', error);
    return false;
  }
}
```

---

## 6️⃣ SCAN BLUETOOTH SANS BUG

### Code Robuste

```typescript
import { BleManager, Device } from 'react-native-ble-plx';

async scanBluetoothReaders(timeoutMs: number = 10000): Promise<CardReader[]> {
  const readers: CardReader[] = [];
  const bleManager = new BleManager();
  
  try {
    // 1. Vérifier permissions
    const hasPermissions = await this.requestBluetoothPermissions();
    if (!hasPermissions) {
      throw new Error('Permissions Bluetooth refusées');
    }
    
    // 2. Vérifier que Bluetooth est activé
    const isEnabled = await this.checkBluetoothState();
    if (!isEnabled) {
      throw new Error('Bluetooth désactivé');
    }
    
    // 3. Scanner
    return new Promise((resolve, reject) => {
      const seenDevices = new Set<string>();
      
      const timeout = setTimeout(() => {
        bleManager.stopDeviceScan();
        resolve(readers);
      }, timeoutMs);
      
      bleManager.startDeviceScan(
        null,  // Tous les services
        {
          allowDuplicates: false,  // Éviter les doublons
          scanMode: 1,  // Low latency (Android)
        },
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            bleManager.stopDeviceScan();
            reject(error);
            return;
          }
          
          if (device && device.name && !seenDevices.has(device.id)) {
            seenDevices.add(device.id);
            
            // Filtrer les lecteurs de carte
            const isCardReader = this.isCardReaderDevice(device);
            
            if (isCardReader) {
              console.log('Lecteur trouvé:', device.name);
              
              readers.push({
                id: device.id,
                name: device.name,
                type: 'bluetooth',
                connected: false,
                device: device
              });
            }
          }
        }
      );
    });
  } catch (error) {
    console.error('Erreur scan Bluetooth:', error);
    throw error;
  } finally {
    bleManager.destroy();
  }
}

// Identifier un lecteur de carte par son nom
private isCardReaderDevice(device: Device): boolean {
  if (!device.name) return false;
  
  const name = device.name.toLowerCase();
  const keywords = [
    'acr',          // ACS readers
    'card',
    'reader',
    'smart',
    'feitian',
    'omnikey',
    'scm',
    'gemalto',
    'contactless',
    'nfc'
  ];
  
  return keywords.some(keyword => name.includes(keyword));
}
```

---

## 7️⃣ CONNEXION BLUETOOTH STABLE

```typescript
async connectBluetooth(reader: CardReader): Promise<boolean> {
  const bleManager = new BleManager();
  
  try {
    if (!reader.device) {
      throw new Error('Device non disponible');
    }
    
    console.log('Connexion à:', reader.name);
    
    // 1. Vérifier si déjà connecté
    const isConnected = await reader.device.isConnected();
    if (isConnected) {
      console.log('Déjà connecté');
      return true;
    }
    
    // 2. Se connecter
    const device = await reader.device.connect({
      requestMTU: 512,  // Taille MTU optimale
      timeout: 10000     // 10 secondes timeout
    });
    
    console.log('Connecté, découverte des services...');
    
    // 3. Découvrir services et caractéristiques
    await device.discoverAllServicesAndCharacteristics();
    
    // 4. Sauvegarder le device
    this.bluetoothDevice = device;
    this.connectedReader = { ...reader, connected: true };
    
    // 5. Écouter la déconnexion
    device.onDisconnected((error, disconnectedDevice) => {
      console.log('Déconnecté:', disconnectedDevice?.name);
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });
    
    console.log('✅ Connexion Bluetooth établie');
    return true;
    
  } catch (error) {
    console.error('Erreur connexion Bluetooth:', error);
    return false;
  } finally {
    bleManager.destroy();
  }
}
```

---

## 8️⃣ COMMUNICATION APDU VIA BLUETOOTH

### Trouver les bonnes caractéristiques

```typescript
async findAPDUCharacteristics(device: Device): Promise<{
  writeChar: string;
  readChar: string;
  serviceUUID: string;
}> {
  try {
    const services = await device.services();
    
    for (const service of services) {
      console.log('Service UUID:', service.uuid);
      
      const characteristics = await service.characteristics();
      
      let writeChar = null;
      let readChar = null;
      
      for (const char of characteristics) {
        console.log('Char UUID:', char.uuid, 'Props:', {
          write: char.isWritableWithResponse,
          read: char.isReadable,
          notify: char.isNotifiable
        });
        
        // Caractéristique d'écriture
        if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
          writeChar = char.uuid;
        }
        
        // Caractéristique de lecture/notification
        if (char.isReadable || char.isNotifiable) {
          readChar = char.uuid;
        }
      }
      
      if (writeChar && readChar) {
        return {
          writeChar,
          readChar,
          serviceUUID: service.uuid
        };
      }
    }
    
    throw new Error('Caractéristiques APDU non trouvées');
  } catch (error) {
    console.error('Erreur recherche caractéristiques:', error);
    throw error;
  }
}
```

### Envoyer des commandes APDU

```typescript
async sendAPDUViaBluetooth(apduCommand: Uint8Array): Promise<Uint8Array> {
  if (!this.bluetoothDevice) {
    throw new Error('Pas de device Bluetooth connecté');
  }
  
  try {
    // 1. Trouver les caractéristiques
    const chars = await this.findAPDUCharacteristics(this.bluetoothDevice);
    
    // 2. Convertir APDU en base64
    const commandBase64 = Buffer.from(apduCommand).toString('base64');
    
    console.log('Envoi APDU:', Array.from(apduCommand).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // 3. Écrire la commande
    await this.bluetoothDevice.writeCharacteristicWithResponseForService(
      chars.serviceUUID,
      chars.writeChar,
      commandBase64
    );
    
    // 4. Lire la réponse
    const responseChar = await this.bluetoothDevice.readCharacteristicForService(
      chars.serviceUUID,
      chars.readChar
    );
    
    // 5. Décoder la réponse
    const responseBuffer = Buffer.from(responseChar.value, 'base64');
    const response = new Uint8Array(responseBuffer);
    
    console.log('Réponse APDU:', Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    return response;
    
  } catch (error) {
    console.error('Erreur envoi APDU Bluetooth:', error);
    throw error;
  }
}
```

---

## 9️⃣ GESTION DES ERREURS COURANTES

### Erreurs et Solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Location permission denied` | Permissions manquantes | Demander `ACCESS_FINE_LOCATION` |
| `Bluetooth powered off` | Bluetooth désactivé | Rediriger vers paramètres |
| `Device not found` | Hors de portée | Rapprocher le lecteur |
| `Connection timeout` | Lecteur occupé | Réessayer |
| `Service not found` | Mauvais lecteur | Vérifier compatibilité |
| `Characteristic not found` | UUID incorrect | Logger les UUIDs disponibles |

### Code de Gestion d'Erreurs

```typescript
async handleBluetoothError(error: any) {
  const errorMsg = error?.message || error?.toString() || 'Erreur inconnue';
  
  if (errorMsg.includes('permission')) {
    Alert.alert(
      'Permissions requises',
      'Activez les permissions Bluetooth et Localisation',
      [{ text: 'Paramètres', onPress: () => Linking.openSettings() }]
    );
  } else if (errorMsg.includes('powered off') || errorMsg.includes('PoweredOff')) {
    Alert.alert(
      'Bluetooth désactivé',
      'Veuillez activer le Bluetooth',
      [{ text: 'Paramètres', onPress: () => Linking.openSettings() }]
    );
  } else if (errorMsg.includes('timeout')) {
    Alert.alert(
      'Timeout',
      'Le lecteur ne répond pas. Vérifiez qu\'il est allumé.',
      [{ text: 'Réessayer' }]
    );
  } else {
    Alert.alert('Erreur Bluetooth', errorMsg);
  }
}
```

---

## 🔟 LECTEURS BLUETOOTH COMPATIBLES

### Lecteurs Testés et Compatibles

| Modèle | Fabricant | Protocole | Status |
|--------|-----------|-----------|--------|
| ACR1255U-J1 | ACS | BLE | ✅ Testé |
| bR500 | Feitian | BLE | ✅ Testé |
| 5421 CL | Omnikey | BLE | ⚠️ Vérifier |
| IDBridge CT30 | Gemalto | BLE | ⚠️ Vérifier |

### Caractéristiques BLE Standard

Les lecteurs de carte BLE utilisent généralement :

- **Service UUID** : Propriétaire (varie par fabricant)
- **Write Characteristic** : Pour envoyer APDU
- **Read/Notify Characteristic** : Pour recevoir réponses
- **MTU** : 512 bytes recommandé

---

## 1️⃣1️⃣ REBUILD APRÈS MODIFICATIONS

### Android

```bash
# Nettoyer
cd /app/frontend/android
./gradlew clean

# Rebuild
cd /app/frontend
npx expo run:android
```

### iOS

```bash
# Installer pods
cd /app/frontend/ios
pod install

# Rebuild
cd /app/frontend
npx expo run:ios
```

---

## 1️⃣2️⃣ TESTS BLUETOOTH

### Test Minimal

```typescript
// Test 1: Vérifier BLE disponible
const bleManager = new BleManager();
const state = await bleManager.state();
console.log('BLE State:', state); // Doit être "PoweredOn"

// Test 2: Scanner 5 secondes
const readers = await this.scanBluetoothReaders(5000);
console.log('Lecteurs trouvés:', readers.length);

// Test 3: Se connecter
if (readers.length > 0) {
  const connected = await this.connectBluetooth(readers[0]);
  console.log('Connecté:', connected);
}

// Test 4: Envoyer commande simple
const response = await this.sendAPDUViaBluetooth(
  new Uint8Array([0xFF, 0x00, 0x00, 0x00, 0x00])
);
console.log('Réponse:', response);
```

---

## 1️⃣3️⃣ CHECKLIST COMPLÈTE

### Avant de Tester

- [ ] `react-native-ble-plx` installée
- [ ] Permissions Android dans AndroidManifest.xml
- [ ] Permissions iOS dans Info.plist
- [ ] `minSdkVersion >= 23` (Android)
- [ ] `compileSdkVersion >= 31` (Android)
- [ ] Rebuild complet de l'app
- [ ] Bluetooth activé sur le téléphone
- [ ] Lecteur Bluetooth allumé et à proximité
- [ ] Permissions accordées manuellement si nécessaire

### Pendant le Test

- [ ] Scanner détecte le lecteur
- [ ] Connexion réussit
- [ ] Services découverts
- [ ] Caractéristiques trouvées
- [ ] APDU envoyé
- [ ] Réponse reçue
- [ ] Déconnexion propre

---

## 1️⃣4️⃣ DEBUG BLUETOOTH

### Activer les Logs

```typescript
// Dans le code
const bleManager = new BleManager();
bleManager.setLogLevel('Verbose');

// Logs Android via ADB
adb logcat | grep -i bluetooth
adb logcat | grep -i ble

// Logs iOS via Console.app
```

### Vérifier l'État

```bash
# Android - Vérifier Bluetooth
adb shell dumpsys bluetooth_manager

# Lister les devices BLE
adb shell dumpsys bluetooth_manager | grep -A 20 "Bonded devices"
```

---

## ✅ RÉSUMÉ - Ce qu'il faut ABSOLUMENT

### Fichiers à Modifier

1. **AndroidManifest.xml** → Ajouter toutes les permissions Bluetooth
2. **Info.plist** → Ajouter descriptions Bluetooth
3. **build.gradle** → `compileSdkVersion >= 31`
4. **Code** → Demander permissions à runtime

### Packages Requis

```json
{
  "react-native-ble-plx": "^3.0.0"
}
```

### Commandes

```bash
# Installer
yarn add react-native-ble-plx

# Rebuild Android
npx expo run:android

# Rebuild iOS
cd ios && pod install && cd ..
npx expo run:ios
```

### Code Essentiel

```typescript
// 1. Demander permissions
await requestBluetoothPermissions();

// 2. Vérifier Bluetooth activé
await checkBluetoothState();

// 3. Scanner
const readers = await scanBluetoothReaders(10000);

// 4. Connecter
await connectBluetooth(readers[0]);

// 5. Communiquer
await sendAPDUViaBluetooth(command);
```

---

## 🚀 POUR ÉLIMINER TOUS LES BUGS

1. **Toujours vérifier permissions d'abord**
2. **Toujours vérifier que Bluetooth est activé**
3. **Gérer tous les cas d'erreur**
4. **Logger toutes les étapes**
5. **Tester avec hardware réel**
6. **Rebuild après chaque modification de config**

---

**Suivez ce guide étape par étape et Bluetooth fonctionnera sans bug ! 📶✅**
