/**
 * Service Bluetooth dédié au Feitian bR301-BLE
 * Implémentation réelle avec react-native-ble-plx
 * 
 * Ce service gère :
 * - Scan des devices bR301-BLE
 * - Connexion et déconnexion
 * - Communication APDU
 * - Détection de carte
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { PlatformService } from './platformService';
import { BR301_CONFIG, isBR301Device } from '../config/br301Config';

// Types
export interface BR301Device {
  id: string;
  name: string;
  rssi: number | null;
  connected: boolean;
  device: any; // BleDevice from react-native-ble-plx
}

export interface CardInfo {
  present: boolean;
  atr: string | null;
  protocol: 'T0' | 'T1' | null;
}

export interface APDUResponse {
  data: Uint8Array;
  sw1: number;
  sw2: number;
  success: boolean;
}

// Constantes BLE pour bR301
// Note: Ces UUIDs doivent être découverts lors du premier scan
const BR301_BLE = {
  // Service principal CCID (à découvrir)
  SERVICE_UUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  // Caractéristique d'écriture APDU
  WRITE_CHAR_UUID: '0000fff1-0000-1000-8000-00805f9b34fb',
  // Caractéristique de lecture APDU
  READ_CHAR_UUID: '0000fff2-0000-1000-8000-00805f9b34fb',
  // Caractéristique de notification
  NOTIFY_CHAR_UUID: '0000fff3-0000-1000-8000-00805f9b34fb',
};

class BR301BleService {
  private bleManager: any = null;
  private connectedDevice: any = null;
  private serviceUUID: string | null = null;
  private writeCharUUID: string | null = null;
  private readCharUUID: string | null = null;
  private notifyCharUUID: string | null = null;
  private isInitialized: boolean = false;
  private cardMonitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Ne pas initialiser sur le web
    if (PlatformService.isNative) {
      this.initBleManager();
    }
  }

  // =============== INITIALISATION ===============

  private async initBleManager() {
    if (!PlatformService.canUseBluetooth) {
      console.log('Bluetooth non disponible sur cette plateforme');
      return;
    }

    try {
      // Import dynamique pour éviter les erreurs sur web
      const { BleManager } = await import('react-native-ble-plx');
      this.bleManager = new BleManager();
      this.isInitialized = true;
      console.log('✅ BLE Manager initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation BLE:', error);
    }
  }

  // =============== PERMISSIONS ===============

  async requestPermissions(): Promise<boolean> {
    if (!PlatformService.isNative) {
      console.warn('Permissions non requises sur le web');
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        
        let permissions: string[] = [];
        
        // Android 12+ (API 31+)
        if (apiLevel >= 31) {
          permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
        } else {
          // Android < 12
          permissions = [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ];
        }

        const results = await PermissionsAndroid.requestMultiple(permissions as any);
        
        const allGranted = Object.values(results).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions requises',
            'Les permissions Bluetooth et Localisation sont nécessaires pour utiliser le lecteur de carte.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() }
            ]
          );
          return false;
        }

        return true;
      } catch (error) {
        console.error('Erreur permissions:', error);
        return false;
      }
    }

    // iOS - les permissions sont gérées automatiquement
    return true;
  }

  // =============== VÉRIFICATION BLUETOOTH ===============

  async checkBluetoothState(): Promise<boolean> {
    if (!this.bleManager) {
      await this.initBleManager();
    }

    if (!this.bleManager) {
      return false;
    }

    try {
      const state = await this.bleManager.state();
      console.log('État Bluetooth:', state);

      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth désactivé',
          'Veuillez activer le Bluetooth pour utiliser le lecteur bR301-BLE.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: () => Linking.openSettings() }
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

  // =============== SCAN DES DEVICES ===============

  async scanForBR301(timeoutMs: number = 15000): Promise<BR301Device[]> {
    // Vérification plateforme
    if (!PlatformService.canUseBluetooth) {
      console.warn(PlatformService.getUnavailableMessage('Bluetooth'));
      return this.getMockedDevices();
    }

    // Vérifier permissions
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Permissions Bluetooth non accordées');
    }

    // Vérifier état Bluetooth
    const btReady = await this.checkBluetoothState();
    if (!btReady) {
      throw new Error('Bluetooth non disponible');
    }

    if (!this.bleManager) {
      throw new Error('BLE Manager non initialisé');
    }

    const devices: BR301Device[] = [];
    const seenIds = new Set<string>();

    return new Promise((resolve, reject) => {
      console.log('🔍 Démarrage scan bR301-BLE...');

      const timeout = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        console.log(`Scan terminé. ${devices.length} bR301 trouvé(s)`);
        resolve(devices);
      }, timeoutMs);

      this.bleManager.startDeviceScan(
        null, // Pas de filtre UUID pour trouver tous les devices
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            clearTimeout(timeout);
            this.bleManager.stopDeviceScan();
            console.error('Erreur scan BLE:', error);
            reject(error);
            return;
          }

          if (device && device.name && !seenIds.has(device.id)) {
            seenIds.add(device.id);

            // Log tous les devices pour debug
            console.log(`Device trouvé: ${device.name} (${device.id}) RSSI: ${device.rssi}`);

            // Vérifier si c'est un bR301
            if (isBR301Device(device.name)) {
              console.log('✅ bR301-BLE détecté:', device.name);
              
              devices.push({
                id: device.id,
                name: device.name,
                rssi: device.rssi,
                connected: false,
                device: device
              });
            }
          }
        }
      );
    });
  }

  // =============== CONNEXION ===============

  async connect(br301Device: BR301Device): Promise<boolean> {
    if (!PlatformService.canUseBluetooth || !this.bleManager) {
      console.warn('Bluetooth non disponible');
      return false;
    }

    try {
      console.log('📶 Connexion à', br301Device.name);

      // Arrêter le scan d'abord
      this.bleManager.stopDeviceScan();

      // Vérifier si déjà connecté
      const isConnected = await br301Device.device.isConnected();
      if (isConnected) {
        console.log('Déjà connecté');
        this.connectedDevice = br301Device.device;
        await this.discoverServices();
        return true;
      }

      // Connexion avec timeout et MTU
      const device = await br301Device.device.connect({
        requestMTU: 512,
        timeout: 10000
      });

      console.log('✅ Connecté ! Découverte des services...');
      this.connectedDevice = device;

      // Découvrir les services
      await this.discoverServices();

      // Écouter les déconnexions
      device.onDisconnected((error: any, disconnectedDevice: any) => {
        console.log('⚠️ bR301-BLE déconnecté', error?.message);
        this.connectedDevice = null;
        this.serviceUUID = null;
        this.writeCharUUID = null;
        this.readCharUUID = null;
      });

      return true;

    } catch (error: any) {
      console.error('❌ Erreur connexion:', error);
      
      if (error.message?.includes('timeout')) {
        Alert.alert(
          'Timeout de connexion',
          'Impossible de se connecter. Vérifiez que le lecteur est allumé et à proximité.'
        );
      }
      
      return false;
    }
  }

  // =============== DÉCOUVERTE DES SERVICES ===============

  private async discoverServices(): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('Pas de device connecté');
    }

    try {
      // Découvrir tous les services et caractéristiques
      await this.connectedDevice.discoverAllServicesAndCharacteristics();

      const services = await this.connectedDevice.services();
      console.log(`📋 ${services.length} service(s) trouvé(s)`);

      // Parcourir les services pour trouver les bonnes caractéristiques
      for (const service of services) {
        console.log('Service:', service.uuid);
        
        const characteristics = await service.characteristics();
        
        for (const char of characteristics) {
          console.log('  Char:', char.uuid, {
            isWritable: char.isWritableWithResponse || char.isWritableWithoutResponse,
            isReadable: char.isReadable,
            isNotifiable: char.isNotifiable
          });

          // Trouver les caractéristiques utiles
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            if (!this.writeCharUUID) {
              this.writeCharUUID = char.uuid;
              this.serviceUUID = service.uuid;
              console.log('✅ Write char trouvée:', char.uuid);
            }
          }
          
          if (char.isReadable) {
            if (!this.readCharUUID) {
              this.readCharUUID = char.uuid;
              console.log('✅ Read char trouvée:', char.uuid);
            }
          }

          if (char.isNotifiable) {
            this.notifyCharUUID = char.uuid;
            console.log('✅ Notify char trouvée:', char.uuid);
            
            // S'abonner aux notifications
            await this.subscribeToNotifications(char);
          }
        }
      }

      if (!this.writeCharUUID || !this.serviceUUID) {
        console.warn('⚠️ Caractéristiques APDU non trouvées automatiquement');
      }

    } catch (error) {
      console.error('Erreur découverte services:', error);
      throw error;
    }
  }

  private async subscribeToNotifications(characteristic: any): Promise<void> {
    try {
      characteristic.monitor((error: any, char: any) => {
        if (error) {
          console.error('Erreur notification:', error);
          return;
        }
        
        if (char?.value) {
          console.log('📥 Notification reçue:', char.value);
        }
      });
    } catch (error) {
      console.error('Erreur subscription notifications:', error);
    }
  }

  // =============== ENVOI APDU ===============

  async sendAPDU(command: Uint8Array): Promise<APDUResponse> {
    if (!PlatformService.canUseBluetooth) {
      // Mode simulation pour le web
      return this.simulateAPDUResponse(command);
    }

    if (!this.connectedDevice || !this.serviceUUID || !this.writeCharUUID) {
      throw new Error('Lecteur non connecté ou caractéristiques non découvertes');
    }

    try {
      // Convertir en base64 pour l'envoi BLE
      const commandBase64 = this.uint8ArrayToBase64(command);
      
      console.log('📤 Envoi APDU:', this.bytesToHex(command));

      // Écrire la commande
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        this.serviceUUID,
        this.writeCharUUID,
        commandBase64
      );

      // Attendre un peu pour la réponse
      await new Promise(resolve => setTimeout(resolve, 300));

      // Lire la réponse
      if (this.readCharUUID) {
        const response = await this.connectedDevice.readCharacteristicForService(
          this.serviceUUID,
          this.readCharUUID
        );

        if (response?.value) {
          const responseData = this.base64ToUint8Array(response.value);
          console.log('📥 Réponse APDU:', this.bytesToHex(responseData));

          const len = responseData.length;
          return {
            data: responseData.slice(0, len - 2),
            sw1: responseData[len - 2] || 0,
            sw2: responseData[len - 1] || 0,
            success: responseData[len - 2] === 0x90 && responseData[len - 1] === 0x00
          };
        }
      }

      // Pas de réponse
      return {
        data: new Uint8Array(0),
        sw1: 0x6F,
        sw2: 0x00,
        success: false
      };

    } catch (error) {
      console.error('Erreur envoi APDU:', error);
      throw error;
    }
  }

  // =============== DÉTECTION DE CARTE ===============

  async detectCard(): Promise<CardInfo> {
    if (!PlatformService.canUseBluetooth || !this.connectedDevice) {
      return { present: false, atr: null, protocol: null };
    }

    try {
      // Commande GET SLOT STATUS (CCID)
      const statusCmd = new Uint8Array([0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const response = await this.sendAPDU(statusCmd);

      // Analyser la réponse pour détecter la présence de carte
      // Le byte de status indique si une carte est présente
      if (response.sw1 === 0x90 && response.sw2 === 0x00) {
        // Carte présente - obtenir l'ATR
        const atr = await this.getATR();
        return {
          present: true,
          atr: atr,
          protocol: 'T0' // Par défaut
        };
      }

      return { present: false, atr: null, protocol: null };

    } catch (error) {
      console.error('Erreur détection carte:', error);
      return { present: false, atr: null, protocol: null };
    }
  }

  async getATR(): Promise<string | null> {
    try {
      // Commande POWER ON ICC (CCID)
      const powerOnCmd = new Uint8Array([0x62, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const response = await this.sendAPDU(powerOnCmd);

      if (response.data.length > 0) {
        return this.bytesToHex(response.data);
      }

      return null;
    } catch (error) {
      console.error('Erreur lecture ATR:', error);
      return null;
    }
  }

  // =============== SURVEILLANCE CARTE ===============

  startCardMonitoring(
    onCardInserted: (cardInfo: CardInfo) => void,
    onCardRemoved: () => void,
    intervalMs: number = 1000
  ): void {
    if (this.cardMonitoringInterval) {
      this.stopCardMonitoring();
    }

    console.log('🔍 Démarrage surveillance carte...');
    let lastPresent = false;

    this.cardMonitoringInterval = setInterval(async () => {
      try {
        const cardInfo = await this.detectCard();

        if (cardInfo.present && !lastPresent) {
          console.log('✅ Carte insérée !');
          onCardInserted(cardInfo);
        } else if (!cardInfo.present && lastPresent) {
          console.log('❌ Carte retirée');
          onCardRemoved();
        }

        lastPresent = cardInfo.present;
      } catch (error) {
        console.error('Erreur monitoring:', error);
      }
    }, intervalMs);
  }

  stopCardMonitoring(): void {
    if (this.cardMonitoringInterval) {
      clearInterval(this.cardMonitoringInterval);
      this.cardMonitoringInterval = null;
      console.log('🛑 Surveillance carte arrêtée');
    }
  }

  // =============== DÉCONNEXION ===============

  async disconnect(): Promise<void> {
    this.stopCardMonitoring();

    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        console.log('Déconnecté du bR301-BLE');
      } catch (error) {
        console.error('Erreur déconnexion:', error);
      }
    }

    this.connectedDevice = null;
    this.serviceUUID = null;
    this.writeCharUUID = null;
    this.readCharUUID = null;
    this.notifyCharUUID = null;
  }

  // =============== UTILITAIRES ===============

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  // =============== SIMULATION WEB ===============

  private getMockedDevices(): BR301Device[] {
    console.log('📱 Mode web: retour de devices simulés');
    return [
      {
        id: 'mock-br301-1',
        name: 'bR301-BLE (Simulé)',
        rssi: -60,
        connected: false,
        device: null
      }
    ];
  }

  private async simulateAPDUResponse(command: Uint8Array): Promise<APDUResponse> {
    console.log('📱 Mode web: simulation APDU');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      data: new Uint8Array([0x90, 0x00]),
      sw1: 0x90,
      sw2: 0x00,
      success: true
    };
  }

  // =============== GETTERS ===============

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): any {
    return this.connectedDevice;
  }

  isAvailable(): boolean {
    return PlatformService.canUseBluetooth && this.isInitialized;
  }
}

// Export singleton
export default new BR301BleService();
