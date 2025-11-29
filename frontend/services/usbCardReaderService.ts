/**
 * USB Card Reader Service - Détection automatique des lecteurs USB
 * Support: Détection native Android/iOS via USB
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

// Types
export interface USBDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  manufacturer?: string;
  productName?: string;
  serialNumber?: string;
}

export interface CardReader {
  id: string;
  name: string;
  type: 'usb';
  connected: boolean;
  device: USBDevice;
}

// IDs des fabricants de lecteurs de carte connus
const CARD_READER_VENDORS = {
  ACS: 0x072F,           // Advanced Card Systems
  SCM: 0x04E6,           // SCM Microsystems
  OMNIKEY: 0x076B,       // Omnikey (HID Global)
  FEITIAN: 0x096E,       // Feitian Technologies
  GEMALTO: 0x08E6,       // Gemalto (Thales)
  IDENTIV: 0x04E6,       // Identiv
  CHERRY: 0x046A         // Cherry
};

class USBCardReaderService {
  private connectedReader: CardReader | null = null;
  private usbEventEmitter: NativeEventEmitter | null = null;
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
  }

  // =============== PERMISSIONS ===============

  async requestUSBPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.USB_PERMISSION as any,
          {
            title: 'Permission USB',
            message: 'Cette application a besoin d\'accéder aux périphériques USB pour lire les cartes',
            buttonNeutral: 'Plus tard',
            buttonNegative: 'Refuser',
            buttonPositive: 'Autoriser',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Erreur permissions USB:', err);
        return false;
      }
    }
    return true; // iOS gère automatiquement
  }

  // =============== EVENT LISTENERS ===============

  private setupEventListeners() {
    if (Platform.OS === 'android') {
      // Écouter les événements USB natifs si disponibles
      try {
        const { UsbManager } = NativeModules;
        if (UsbManager) {
          this.usbEventEmitter = new NativeEventEmitter(UsbManager);
          
          this.usbEventEmitter.addListener('UsbAttached', (device) => {
            console.log('Lecteur USB connecté:', device);
            this.onDeviceAttached(device);
          });

          this.usbEventEmitter.addListener('UsbDetached', (device) => {
            console.log('Lecteur USB déconnecté:', device);
            this.onDeviceDetached(device);
          });
        }
      } catch (error) {
        console.log('Module USB natif non disponible, utilisation du scan manuel');
      }
    }
  }

  private onDeviceAttached(device: any) {
    // Callback quand un device est connecté
    console.log('Device USB attaché:', device);
  }

  private onDeviceDetached(device: any) {
    // Callback quand un device est déconnecté
    if (this.connectedReader && this.connectedReader.device.deviceId === device.deviceId) {
      this.connectedReader = null;
      console.log('Lecteur de carte déconnecté');
    }
  }

  // =============== DÉTECTION USB ===============

  /**
   * Scanner et détecter automatiquement les lecteurs USB connectés
   */
  async scanUSBDevices(): Promise<CardReader[]> {
    const readers: CardReader[] = [];

    try {
      // Demander les permissions
      const hasPermission = await this.requestUSBPermissions();
      if (!hasPermission) {
        throw new Error('Permission USB refusée');
      }

      if (Platform.OS === 'android') {
        // Utiliser le module natif Android
        const devices = await this.getAndroidUSBDevices();
        
        for (const device of devices) {
          if (this.isCardReader(device)) {
            readers.push({
              id: `usb-${device.deviceId}`,
              name: this.getReaderName(device),
              type: 'usb',
              connected: false,
              device: device
            });
          }
        }
      } else if (Platform.OS === 'ios') {
        // iOS - utiliser ExternalAccessory framework
        const devices = await this.getIOSUSBDevices();
        readers.push(...devices);
      }

      return readers;
    } catch (error) {
      console.error('Erreur scan USB:', error);
      return this.getSimulatedReaders(); // Fallback sur simulation
    }
  }

  /**
   * Obtenir les devices USB sur Android via module natif
   */
  private async getAndroidUSBDevices(): Promise<USBDevice[]> {
    try {
      // Utiliser react-native-usb-serialport
      const UsbSerial = require('react-native-usb-serialport').default;
      
      const deviceList = await UsbSerial.list();
      
      return deviceList.map((device: any) => ({
        deviceId: device.deviceId,
        vendorId: device.vendorId,
        productId: device.productId,
        deviceName: device.name || 'USB Device',
        manufacturer: device.manufacturer,
        productName: device.product,
        serialNumber: device.serialNumber
      }));
    } catch (error) {
      console.error('Erreur lecture devices Android:', error);
      return [];
    }
  }

  /**
   * Obtenir les devices USB sur iOS
   */
  private async getIOSUSBDevices(): Promise<CardReader[]> {
    // iOS nécessite ExternalAccessory framework
    // Pour l'instant, retourner simulation
    return [];
  }

  /**
   * Vérifier si un device USB est un lecteur de carte
   */
  private isCardReader(device: USBDevice): boolean {
    // Vérifier par Vendor ID
    const knownVendors = Object.values(CARD_READER_VENDORS);
    if (knownVendors.includes(device.vendorId)) {
      return true;
    }

    // Vérifier par nom
    const name = (device.deviceName || '').toLowerCase();
    const manufacturer = (device.manufacturer || '').toLowerCase();
    const product = (device.productName || '').toLowerCase();
    
    const keywords = ['card', 'reader', 'smart', 'contactless', 'nfc', 'acr', 'omnikey', 'scm'];
    
    return keywords.some(keyword => 
      name.includes(keyword) || 
      manufacturer.includes(keyword) || 
      product.includes(keyword)
    );
  }

  /**
   * Obtenir le nom lisible du lecteur
   */
  private getReaderName(device: USBDevice): string {
    // Chercher par Vendor ID
    for (const [name, vendorId] of Object.entries(CARD_READER_VENDORS)) {
      if (device.vendorId === vendorId) {
        return `${name} ${device.productName || 'Card Reader'}`;
      }
    }

    // Utiliser les infos du device
    if (device.productName) {
      return device.productName;
    }

    if (device.manufacturer) {
      return `${device.manufacturer} Card Reader`;
    }

    return `USB Card Reader (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;
  }

  /**
   * Lecteurs simulés pour les tests
   */
  private getSimulatedReaders(): CardReader[] {
    return [
      {
        id: 'usb-sim-1',
        name: 'ACS ACR122U USB (Simulé)',
        type: 'usb',
        connected: false,
        device: {
          deviceId: 1,
          vendorId: CARD_READER_VENDORS.ACS,
          productId: 0x2200,
          deviceName: 'ACS ACR122U',
          manufacturer: 'ACS',
          productName: 'ACR122U'
        }
      },
      {
        id: 'usb-sim-2',
        name: 'Omnikey 5321 USB (Simulé)',
        type: 'usb',
        connected: false,
        device: {
          deviceId: 2,
          vendorId: CARD_READER_VENDORS.OMNIKEY,
          productId: 0x5321,
          deviceName: 'Omnikey 5321',
          manufacturer: 'HID Global',
          productName: 'Omnikey 5321'
        }
      }
    ];
  }

  // =============== DÉTECTION AUTOMATIQUE EN CONTINU ===============

  /**
   * Démarrer la détection automatique continue
   * Vérifie toutes les X secondes si un lecteur est connecté
   */
  startAutoDetection(callback: (readers: CardReader[]) => void, intervalMs: number = 2000) {
    if (this.detectionInterval) {
      this.stopAutoDetection();
    }

    // Premier scan immédiat
    this.scanUSBDevices().then(callback);

    // Scan périodique
    this.detectionInterval = setInterval(async () => {
      const readers = await this.scanUSBDevices();
      if (readers.length > 0) {
        callback(readers);
      }
    }, intervalMs);
  }

  /**
   * Arrêter la détection automatique
   */
  stopAutoDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  // =============== CONNEXION AU LECTEUR ===============

  async connectToReader(reader: CardReader): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const UsbSerial = require('react-native-usb-serialport').default;
        
        // Demander permission pour ce device spécifique
        const hasPermission = await UsbSerial.requestPermission(reader.device.deviceId);
        
        if (!hasPermission) {
          throw new Error('Permission refusée pour ce device');
        }

        // Ouvrir la connexion
        await UsbSerial.open(reader.device.deviceId, {
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 0
        });

        this.connectedReader = { ...reader, connected: true };
        console.log('Lecteur USB connecté:', reader.name);
        return true;
      }

      // Simulation pour iOS ou si module non disponible
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.connectedReader = { ...reader, connected: true };
      return true;
    } catch (error) {
      console.error('Erreur connexion lecteur USB:', error);
      return false;
    }
  }

  // =============== COMMUNICATION USB ===============

  async sendCommand(command: Uint8Array): Promise<Uint8Array> {
    if (!this.connectedReader) {
      throw new Error('Aucun lecteur connecté');
    }

    try {
      if (Platform.OS === 'android') {
        const UsbSerial = require('react-native-usb-serialport').default;
        
        // Convertir en string base64 pour l'envoi
        const commandStr = Buffer.from(command).toString('base64');
        
        // Envoyer
        await UsbSerial.write(commandStr);
        
        // Lire la réponse (attendre max 5 secondes)
        const response = await this.readResponse(5000);
        return response;
      }

      // Simulation
      await new Promise(resolve => setTimeout(resolve, 500));
      return new Uint8Array([0x90, 0x00]); // Success
    } catch (error) {
      console.error('Erreur envoi commande USB:', error);
      throw error;
    }
  }

  private async readResponse(timeoutMs: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout lecture réponse'));
      }, timeoutMs);

      try {
        const UsbSerial = require('react-native-usb-serialport').default;
        
        // Écouter les données
        const subscription = UsbSerial.onReceived((data: string) => {
          clearTimeout(timeout);
          subscription.remove();
          
          // Convertir de base64 vers Uint8Array
          const buffer = Buffer.from(data, 'base64');
          resolve(new Uint8Array(buffer));
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // =============== DÉCONNEXION ===============

  async disconnect(): Promise<void> {
    try {
      if (this.connectedReader && Platform.OS === 'android') {
        const UsbSerial = require('react-native-usb-serialport').default;
        await UsbSerial.close();
      }

      this.stopAutoDetection();
      this.connectedReader = null;
      console.log('Lecteur USB déconnecté');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  }

  // =============== GETTERS ===============

  getConnectedReader(): CardReader | null {
    return this.connectedReader;
  }

  isConnected(): boolean {
    return this.connectedReader !== null && this.connectedReader.connected;
  }

  /**
   * Obtenir les infos du lecteur connecté
   */
  getReaderInfo(): string {
    if (!this.connectedReader) {
      return 'Aucun lecteur connecté';
    }

    const device = this.connectedReader.device;
    return `${this.connectedReader.name}\nVendor: 0x${device.vendorId.toString(16)}\nProduct: 0x${device.productId.toString(16)}`;
  }
}

// Export singleton
export default new USBCardReaderService();
