/**
 * Service dédié pour Feitian bR301-BLE
 * Lecteur de carte avec BLE + USB-C
 * ISO-7816, T=0/T=1, Class A/B/C, PC/SC, CCID
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { BR301_CONFIG, isBR301Device } from '../config/br301Config';

export interface BR301Reader {
  id: string;
  name: string;
  type: 'bluetooth' | 'usb';
  rssi?: number;
  connected: boolean;
  device?: any;
}

export interface CardInfo {
  present: boolean;
  atr: string | null;
  protocol: 'T0' | 'T1' | null;
  cardClass: 'A' | 'B' | 'C' | null;
}

class BR301Service {
  private connectedReader: BR301Reader | null = null;
  private bleManager: any = null;
  private usbDevice: any = null;

  // =============== PERMISSIONS ===============

  async requestAllPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions requises',
            'Cette application nécessite les permissions Bluetooth et Localisation pour fonctionner avec le lecteur bR301-BLE',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() }
            ]
          );
          return false;
        }

        return true;
      } catch (err) {
        console.error('Erreur permissions:', err);
        return false;
      }
    }
    return true;
  }

  // =============== BLUETOOTH - SCAN bR301 ===============

  async scanForBR301(timeoutMs: number = 15000): Promise<BR301Reader[]> {
    const readers: BR301Reader[] = [];

    try {
      // Vérifier permissions
      const hasPermissions = await this.requestAllPermissions();
      if (!hasPermissions) {
        throw new Error('Permissions non accordées');
      }

      // Dynamically import BLE manager
      const { BleManager } = await import('react-native-ble-plx');
      this.bleManager = new BleManager();

      // Vérifier que Bluetooth est activé
      const state = await this.bleManager.state();
      console.log('État Bluetooth:', state);

      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth désactivé',
          'Veuillez activer le Bluetooth pour scanner le lecteur bR301-BLE',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: () => Linking.openSettings() }
          ]
        );
        throw new Error('Bluetooth désactivé');
      }

      console.log('🔍 Scan Bluetooth pour bR301-BLE...');

      return new Promise((resolve, reject) => {
        const seenDevices = new Set<string>();

        const timeout = setTimeout(() => {
          this.bleManager.stopDeviceScan();
          console.log(`Scan terminé. ${readers.length} lecteur(s) bR301 trouvé(s)`);
          resolve(readers);
        }, timeoutMs);

        this.bleManager.startDeviceScan(
          null,
          { allowDuplicates: false },
          (error: any, device: any) => {
            if (error) {
              clearTimeout(timeout);
              this.bleManager.stopDeviceScan();
              console.error('Erreur scan:', error);
              reject(error);
              return;
            }

            if (device && device.name && !seenDevices.has(device.id)) {
              seenDevices.add(device.id);

              // Vérifier si c'est un bR301-BLE
              if (isBR301Device(device.name)) {
                console.log('✅ bR301-BLE trouvé:', device.name, 'RSSI:', device.rssi);

                readers.push({
                  id: device.id,
                  name: device.name,
                  type: 'bluetooth',
                  rssi: device.rssi,
                  connected: false,
                  device: device
                });
              }
            }
          }
        );
      });
    } catch (error) {
      console.error('Erreur scan bR301:', error);
      throw error;
    }
  }

  // =============== CONNEXION BLUETOOTH ===============

  async connectBluetoothBR301(reader: BR301Reader): Promise<boolean> {
    try {
      if (!reader.device) {
        throw new Error('Device non disponible');
      }

      console.log('📶 Connexion au bR301-BLE:', reader.name);

      // Vérifier si déjà connecté
      const isConnected = await reader.device.isConnected();
      if (isConnected) {
        console.log('Déjà connecté');
        this.connectedReader = { ...reader, connected: true };
        return true;
      }

      // Se connecter avec MTU adapté
      const device = await reader.device.connect({
        requestMTU: BR301_CONFIG.BLE_CONFIG.MTU,
        timeout: BR301_CONFIG.BLE_CONFIG.TIMEOUT
      });

      console.log('✅ Connecté ! Découverte des services...');

      // Découvrir tous les services et caractéristiques
      await device.discoverAllServicesAndCharacteristics();

      // Logger les services découverts
      const services = await device.services();
      console.log(`Services découverts: ${services.length}`);

      for (const service of services) {
        console.log('Service UUID:', service.uuid);
        const characteristics = await service.characteristics();
        
        for (const char of characteristics) {
          console.log('  → Char UUID:', char.uuid, {
            write: char.isWritableWithResponse,
            read: char.isReadable,
            notify: char.isNotifiable
          });
        }
      }

      // Sauvegarder
      this.connectedReader = { ...reader, connected: true, device: device };

      // Écouter la déconnexion
      device.onDisconnected((error: any, disconnectedDevice: any) => {
        console.log('⚠️ bR301-BLE déconnecté');
        this.connectedReader = null;
        
        Alert.alert(
          'Lecteur déconnecté',
          'Le lecteur bR301-BLE a été déconnecté'
        );
      });

      console.log('✅ bR301-BLE prêt à communiquer');
      return true;

    } catch (error: any) {
      console.error('❌ Erreur connexion bR301:', error);
      
      if (error.message?.includes('timeout')) {
        Alert.alert(
          'Timeout',
          'Impossible de se connecter au bR301-BLE. Vérifiez qu\'il est allumé et à proximité.'
        );
      } else {
        Alert.alert('Erreur de connexion', error.message || 'Erreur inconnue');
      }
      
      return false;
    }
  }

  // =============== COMMUNICATION APDU ===============

  async sendAPDU(apduCommand: Uint8Array): Promise<Uint8Array> {
    if (!this.connectedReader) {
      throw new Error('Lecteur non connecté');
    }

    try {
      if (this.connectedReader.type === 'bluetooth') {
        return await this.sendAPDUBluetooth(apduCommand);
      } else {
        return await this.sendAPDUUSB(apduCommand);
      }
    } catch (error) {
      console.error('Erreur APDU:', error);
      throw error;
    }
  }

  private async sendAPDUBluetooth(apduCommand: Uint8Array): Promise<Uint8Array> {
    if (!this.connectedReader?.device) {
      throw new Error('Device Bluetooth non connecté');
    }

    try {
      const device = this.connectedReader.device;
      
      // Trouver les caractéristiques
      const services = await device.services();
      
      let writeChar = null;
      let readChar = null;
      let serviceUUID = null;

      // Chercher les caractéristiques APDU
      for (const service of services) {
        const characteristics = await service.characteristics();
        
        for (const char of characteristics) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            writeChar = char.uuid;
            serviceUUID = service.uuid;
          }
          if (char.isReadable || char.isNotifiable) {
            readChar = char.uuid;
          }
        }

        if (writeChar && readChar) break;
      }

      if (!writeChar || !readChar || !serviceUUID) {
        throw new Error('Caractéristiques APDU non trouvées');
      }

      console.log('📤 Envoi APDU:', Array.from(apduCommand).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Convertir en base64
      const commandBase64 = Buffer.from(apduCommand).toString('base64');

      // Envoyer
      await device.writeCharacteristicWithResponseForService(
        serviceUUID,
        writeChar,
        commandBase64
      );

      // Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 300));

      // Lire la réponse
      const responseChar = await device.readCharacteristicForService(
        serviceUUID,
        readChar
      );

      const responseBuffer = Buffer.from(responseChar.value, 'base64');
      const response = new Uint8Array(responseBuffer);

      console.log('📥 Réponse APDU:', Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' '));

      return response;

    } catch (error) {
      console.error('Erreur envoi APDU Bluetooth:', error);
      throw error;
    }
  }

  private async sendAPDUUSB(apduCommand: Uint8Array): Promise<Uint8Array> {
    try {
      console.log('📤 Envoi APDU USB:', Array.from(apduCommand).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // TODO: Implémentation USB réelle
      // Pour l'instant simulation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return new Uint8Array([0x90, 0x00]);

    } catch (error) {
      console.error('Erreur envoi APDU USB:', error);
      throw error;
    }
  }

  // =============== DÉTECTION DE CARTE ===============

  async detectCard(): Promise<CardInfo> {
    try {
      // Envoyer GET STATUS
      const statusCmd = new Uint8Array(BR301_CONFIG.APDU_COMMANDS.GET_STATUS);
      const statusResponse = await this.sendAPDU(statusCmd);

      // Analyser la réponse
      const len = statusResponse.length;
      if (len < 2) {
        return { present: false, atr: null, protocol: null, cardClass: null };
      }

      const sw1 = statusResponse[len - 2];
      const sw2 = statusResponse[len - 1];

      if (sw1 === 0x90 && sw2 === 0x00) {
        // Carte présente - Obtenir l'ATR
        const atr = await this.getATR();
        
        return {
          present: true,
          atr: atr,
          protocol: this.detectProtocol(atr),
          cardClass: this.detectCardClass(atr)
        };
      }

      return { present: false, atr: null, protocol: null, cardClass: null };

    } catch (error) {
      console.error('Erreur détection carte:', error);
      return { present: false, atr: null, protocol: null, cardClass: null };
    }
  }

  async getATR(): Promise<string | null> {
    try {
      const powerOnCmd = new Uint8Array(BR301_CONFIG.APDU_COMMANDS.POWER_ON_ICC);
      const response = await this.sendAPDU(powerOnCmd);

      if (response.length > 2) {
        const atrBytes = response.slice(0, response.length - 2);
        return Array.from(atrBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ')
          .toUpperCase();
      }

      return null;
    } catch (error) {
      console.error('Erreur lecture ATR:', error);
      return null;
    }
  }

  private detectProtocol(atr: string | null): 'T0' | 'T1' | null {
    if (!atr) return null;
    
    // Analyse basique de l'ATR
    if (atr.includes('10')) return 'T0';
    if (atr.includes('11')) return 'T1';
    
    return 'T0'; // Par défaut
  }

  private detectCardClass(atr: string | null): 'A' | 'B' | 'C' | null {
    if (!atr) return null;
    
    // Classification basique selon voltage
    return 'A'; // Par défaut (5V)
  }

  // =============== SURVEILLANCE CONTINUE ===============

  startCardMonitoring(
    onCardInserted: (cardInfo: CardInfo) => void,
    onCardRemoved: () => void,
    intervalMs: number = 1000
  ): NodeJS.Timeout {
    console.log('🔍 Démarrage surveillance carte bR301...');

    let lastPresent = false;

    const interval = setInterval(async () => {
      try {
        const cardInfo = await this.detectCard();

        if (cardInfo.present && !lastPresent) {
          // Carte insérée !
          console.log('✅ Carte insérée détectée !');
          onCardInserted(cardInfo);
        } else if (!cardInfo.present && lastPresent) {
          // Carte retirée !
          console.log('❌ Carte retirée');
          onCardRemoved();
        }

        lastPresent = cardInfo.present;

      } catch (error) {
        console.error('Erreur monitoring:', error);
      }
    }, intervalMs);

    return interval;
  }

  stopCardMonitoring(interval: NodeJS.Timeout) {
    clearInterval(interval);
    console.log('🛑 Surveillance carte arrêtée');
  }

  // =============== DÉCONNEXION ===============

  async disconnect(): Promise<void> {
    try {
      if (this.connectedReader?.type === 'bluetooth' && this.connectedReader.device) {
        await this.connectedReader.device.cancelConnection();
        console.log('bR301-BLE déconnecté');
      }

      if (this.bleManager) {
        this.bleManager.destroy();
        this.bleManager = null;
      }

      this.connectedReader = null;
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  }

  // =============== GETTERS ===============

  getConnectedReader(): BR301Reader | null {
    return this.connectedReader;
  }

  isConnected(): boolean {
    return this.connectedReader !== null && this.connectedReader.connected;
  }

  getReaderInfo(): string {
    if (!this.connectedReader) {
      return 'Aucun lecteur connecté';
    }

    const reader = this.connectedReader;
    return `${reader.name}\nType: ${reader.type}\nConnecté: ${reader.connected ? 'Oui' : 'Non'}`;
  }
}

// Export singleton
export default new BR301Service();
