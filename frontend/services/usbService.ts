/**
 * Service USB pour la communication avec le lecteur Feitian bR301
 * 
 * Ce service gère :
 * - Détection des devices USB connectés
 * - Connexion au lecteur bR301 via USB-C
 * - Communication CCID avec les cartes à puce
 * 
 * IMPORTANT: Ce service nécessite un build APK custom (pas Expo Go)
 */

import { Platform } from 'react-native';
import { PlatformService } from './platformService';
import { BR301_USB, USB_SERIAL_CONFIG, CCID_COMMANDS, isBR301Device } from '../config/br301Config';

// Types
export interface USBDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  manufacturerName?: string;
  productName?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  device: USBDevice | null;
  error?: string;
}

// Variable pour le module USB (chargé dynamiquement)
let UsbSerialManager: any = null;
let isUSBAvailable = false;

/**
 * Initialise le module USB
 * Doit être appelé au démarrage de l'application
 */
export async function initUSBModule(): Promise<boolean> {
  if (!PlatformService.isAndroid) {
    console.log('⚠️ USB non disponible sur cette plateforme');
    return false;
  }

  try {
    // Import dynamique du module USB
    const module = await import('react-native-usb-serialport-for-android');
    UsbSerialManager = module.UsbSerialManager;
    isUSBAvailable = true;
    console.log('✅ Module USB initialisé');
    return true;
  } catch (error) {
    console.log('⚠️ Module USB non disponible (Expo Go?)', error);
    isUSBAvailable = false;
    return false;
  }
}

class USBService {
  private connectedDevice: USBDevice | null = null;
  private serialPort: any = null;
  private sequenceNumber: number = 0;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Vérifie si l'USB est disponible
   */
  isAvailable(): boolean {
    return isUSBAvailable && PlatformService.isAndroid;
  }

  /**
   * Liste tous les devices USB connectés
   */
  async listDevices(): Promise<USBDevice[]> {
    if (!this.isAvailable()) {
      console.log('USB non disponible');
      return [];
    }

    try {
      const devices = await UsbSerialManager.list();
      return devices.map((d: any) => ({
        deviceId: d.deviceId,
        vendorId: d.vendorId,
        productId: d.productId,
        deviceName: d.deviceName || 'USB Device',
        manufacturerName: d.manufacturerName,
        productName: d.productName,
      }));
    } catch (error) {
      console.error('Erreur listage USB:', error);
      return [];
    }
  }

  /**
   * Recherche les lecteurs bR301 connectés
   */
  async findBR301Devices(): Promise<USBDevice[]> {
    const allDevices = await this.listDevices();
    return allDevices.filter(d => isBR301Device(d.vendorId, d.productId));
  }

  /**
   * Demande la permission USB pour un device
   */
  async requestPermission(deviceId: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const granted = await UsbSerialManager.tryRequestPermission(deviceId);
      return granted;
    } catch (error) {
      console.error('Erreur permission USB:', error);
      return false;
    }
  }

  /**
   * Connexion au lecteur bR301
   */
  async connect(device: USBDevice): Promise<ConnectionStatus> {
    if (!this.isAvailable()) {
      return {
        connected: false,
        device: null,
        error: 'USB non disponible sur cette plateforme',
      };
    }

    try {
      // Demander la permission
      const hasPermission = await this.requestPermission(device.deviceId);
      if (!hasPermission) {
        return {
          connected: false,
          device: null,
          error: 'Permission USB refusée',
        };
      }

      // Ouvrir le port série
      this.serialPort = await UsbSerialManager.open(
        device.deviceId,
        {
          baudRate: USB_SERIAL_CONFIG.BAUD_RATE,
          dataBits: USB_SERIAL_CONFIG.DATA_BITS,
          stopBits: USB_SERIAL_CONFIG.STOP_BITS,
          parity: USB_SERIAL_CONFIG.PARITY,
        }
      );

      this.connectedDevice = device;
      this.sequenceNumber = 0;

      // Configurer l'écoute des données entrantes
      this.setupDataListener();

      console.log('✅ Connecté au lecteur:', device.deviceName);
      return {
        connected: true,
        device: device,
      };
    } catch (error: any) {
      console.error('Erreur connexion USB:', error);
      return {
        connected: false,
        device: null,
        error: error.message || 'Erreur de connexion USB',
      };
    }
  }

  /**
   * Déconnexion du lecteur
   */
  async disconnect(): Promise<void> {
    if (this.serialPort) {
      try {
        await UsbSerialManager.close();
      } catch (error) {
        console.error('Erreur déconnexion:', error);
      }
    }
    this.serialPort = null;
    this.connectedDevice = null;
    console.log('🔌 Lecteur déconnecté');
  }

  /**
   * Vérifie si connecté
   */
  isConnected(): boolean {
    return this.serialPort !== null && this.connectedDevice !== null;
  }

  /**
   * Obtient le device connecté
   */
  getConnectedDevice(): USBDevice | null {
    return this.connectedDevice;
  }

  /**
   * Envoie une commande CCID brute
   */
  async sendCCIDCommand(messageType: number, data: Uint8Array): Promise<Uint8Array> {
    if (!this.isConnected()) {
      throw new Error('Non connecté au lecteur');
    }

    // Construire le paquet CCID
    const packet = this.buildCCIDPacket(messageType, data);
    
    // Envoyer
    await this.writeData(packet);
    
    // Attendre la réponse
    const response = await this.readResponse();
    
    return response;
  }

  /**
   * Power On ICC - Allume la carte et obtient l'ATR
   */
  async powerOnCard(): Promise<{ success: boolean; atr: string }> {
    try {
      const response = await this.sendCCIDCommand(
        CCID_COMMANDS.PC_to_RDR_IccPowerOn,
        new Uint8Array([0x00]) // Slot 0, auto voltage
      );

      if (response[0] === CCID_COMMANDS.RDR_to_PC_DataBlock) {
        // Extraire l'ATR de la réponse
        const atrLength = response[1] | (response[2] << 8) | (response[3] << 16) | (response[4] << 24);
        const atr = response.slice(10, 10 + atrLength);
        return {
          success: true,
          atr: this.bytesToHex(atr),
        };
      }

      return { success: false, atr: '' };
    } catch (error) {
      console.error('Erreur Power On:', error);
      return { success: false, atr: '' };
    }
  }

  /**
   * Power Off ICC - Éteint la carte
   */
  async powerOffCard(): Promise<boolean> {
    try {
      await this.sendCCIDCommand(
        CCID_COMMANDS.PC_to_RDR_IccPowerOff,
        new Uint8Array([0x00]) // Slot 0
      );
      return true;
    } catch (error) {
      console.error('Erreur Power Off:', error);
      return false;
    }
  }

  /**
   * Get Slot Status - Vérifie si une carte est présente
   */
  async getSlotStatus(): Promise<{ cardPresent: boolean; cardPowered: boolean }> {
    try {
      const response = await this.sendCCIDCommand(
        CCID_COMMANDS.PC_to_RDR_GetSlotStatus,
        new Uint8Array([0x00]) // Slot 0
      );

      if (response[0] === CCID_COMMANDS.RDR_to_PC_SlotStatus) {
        const bmICCStatus = response[7] & 0x03;
        return {
          cardPresent: bmICCStatus !== 0x02, // 0x02 = pas de carte
          cardPowered: bmICCStatus === 0x00, // 0x00 = carte active
        };
      }

      return { cardPresent: false, cardPowered: false };
    } catch (error) {
      console.error('Erreur Get Slot Status:', error);
      return { cardPresent: false, cardPowered: false };
    }
  }

  /**
   * Envoie une commande APDU à la carte
   */
  async sendAPDU(apdu: Uint8Array): Promise<{ data: Uint8Array; sw1: number; sw2: number }> {
    try {
      const response = await this.sendCCIDCommand(
        CCID_COMMANDS.PC_to_RDR_XfrBlock,
        apdu
      );

      if (response[0] === CCID_COMMANDS.RDR_to_PC_DataBlock) {
        const dataLength = response[1] | (response[2] << 8) | (response[3] << 16) | (response[4] << 24);
        const responseData = response.slice(10, 10 + dataLength);
        
        // Les 2 derniers octets sont SW1 et SW2
        const sw1 = responseData[responseData.length - 2];
        const sw2 = responseData[responseData.length - 1];
        const data = responseData.slice(0, responseData.length - 2);

        return { data, sw1, sw2 };
      }

      throw new Error('Réponse CCID invalide');
    } catch (error) {
      console.error('Erreur APDU:', error);
      throw error;
    }
  }

  // =============== HELPERS PRIVÉS ===============

  private setupDataListener() {
    if (!this.serialPort) return;

    // Écouter les données entrantes
    UsbSerialManager.onReceived((data: any) => {
      this.emit('data', data);
    });

    UsbSerialManager.onError((error: any) => {
      console.error('Erreur USB:', error);
      this.emit('error', error);
    });
  }

  private buildCCIDPacket(messageType: number, data: Uint8Array): Uint8Array {
    const length = data.length;
    const packet = new Uint8Array(10 + length);
    
    packet[0] = messageType;                    // bMessageType
    packet[1] = length & 0xFF;                  // dwLength (byte 0)
    packet[2] = (length >> 8) & 0xFF;           // dwLength (byte 1)
    packet[3] = (length >> 16) & 0xFF;          // dwLength (byte 2)
    packet[4] = (length >> 24) & 0xFF;          // dwLength (byte 3)
    packet[5] = 0x00;                           // bSlot
    packet[6] = this.sequenceNumber++ & 0xFF;   // bSeq
    packet[7] = 0x00;                           // RFU / bBWI
    packet[8] = 0x00;                           // RFU / wLevelParameter
    packet[9] = 0x00;                           // RFU / wLevelParameter
    
    // Copier les données
    packet.set(data, 10);
    
    return packet;
  }

  private async writeData(data: Uint8Array): Promise<void> {
    if (!this.serialPort) throw new Error('Non connecté');
    
    const hexString = this.bytesToHex(data);
    await UsbSerialManager.writeHexString(hexString);
  }

  private readResponse(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout lecture'));
      }, 5000);

      const handler = (data: any) => {
        clearTimeout(timeout);
        this.off('data', handler);
        resolve(new Uint8Array(data));
      };

      this.on('data', handler);
    });
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  // Event emitter simple
  private on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

// Export singleton
const usbService = new USBService();
export default usbService;
