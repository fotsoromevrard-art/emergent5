/**
 * Service USB dédié au Feitian bR301-BLE (mode USB-C)
 * Utilise react-native-usb-serialport-for-android
 */

import { Platform, NativeModules, NativeEventEmitter, PermissionsAndroid } from 'react-native';
import { PlatformService } from './platformService';
import { BR301_CONFIG, isBR301USB } from '../config/br301Config';

export interface USBDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
}

export interface BR301USBDevice {
  id: string;
  name: string;
  connected: boolean;
  device: USBDevice;
}

class BR301UsbService {
  private connectedDevice: BR301USBDevice | null = null;
  private usbEventEmitter: NativeEventEmitter | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private UsbSerial: any = null;

  constructor() {
    if (PlatformService.isAndroid) {
      this.initUSBModule();
    }
  }

  // =============== INITIALISATION ===============

  private async initUSBModule() {
    if (!PlatformService.canUseUSB) {
      console.log('USB non disponible sur cette plateforme');
      return;
    }

    try {
      // Import dynamique pour éviter les erreurs sur autres plateformes
      this.UsbSerial = require('react-native-usb-serialport').default;
      console.log('✅ Module USB initialisé');

      // Configurer les listeners d'événements USB si disponibles
      this.setupUSBEventListeners();
    } catch (error) {
      console.error('❌ Erreur initialisation USB:', error);
    }
  }

  private setupUSBEventListeners() {
    try {
      const { UsbManager } = NativeModules;
      if (UsbManager) {
        this.usbEventEmitter = new NativeEventEmitter(UsbManager);
        
        this.usbEventEmitter.addListener('UsbAttached', (device: any) => {
          console.log('📌 Device USB connecté:', device);
        });

        this.usbEventEmitter.addListener('UsbDetached', (device: any) => {
          console.log('📌 Device USB déconnecté:', device);
          if (this.connectedDevice && this.connectedDevice.device.deviceId === device.deviceId) {
            this.connectedDevice = null;
          }
        });
      }
    } catch (error) {
      console.log('Événements USB natifs non disponibles');
    }
  }

  // =============== SCAN USB ===============

  async scanUSBDevices(): Promise<BR301USBDevice[]> {
    if (!PlatformService.canUseUSB) {
      console.warn(PlatformService.getUnavailableMessage('USB'));
      return this.getMockedDevices();
    }

    if (!this.UsbSerial) {
      await this.initUSBModule();
    }

    try {
      const devices: BR301USBDevice[] = [];
      const usbDevices = await this.UsbSerial.list();

      console.log(`🔍 ${usbDevices.length} device(s) USB trouvé(s)`);

      for (const device of usbDevices) {
        console.log('Device USB:', {
          vendorId: device.vendorId?.toString(16),
          productId: device.productId?.toString(16),
          name: device.name
        });

        // Vérifier si c'est un bR301 (par vendor ID Feitian)
        if (isBR301USB(device.vendorId, device.productId) || this.isCardReader(device)) {
          console.log('✅ bR301 USB détecté');
          
          devices.push({
            id: `usb-${device.deviceId}`,
            name: device.name || `Feitian bR301 USB`,
            connected: false,
            device: {
              deviceId: device.deviceId,
              vendorId: device.vendorId,
              productId: device.productId,
              deviceName: device.name || 'USB Card Reader'
            }
          });
        }
      }

      return devices;

    } catch (error) {
      console.error('Erreur scan USB:', error);
      return [];
    }
  }

  private isCardReader(device: any): boolean {
    // Vérifier par vendor ID connus des lecteurs de carte
    const cardReaderVendors = [
      0x096E, // Feitian
      0x072F, // ACS
      0x04E6, // SCM
      0x076B, // Omnikey
      0x08E6, // Gemalto
    ];

    return cardReaderVendors.includes(device.vendorId);
  }

  // =============== DÉTECTION AUTOMATIQUE ===============

  startAutoDetection(
    onDevicesFound: (devices: BR301USBDevice[]) => void,
    intervalMs: number = 2000
  ): void {
    if (this.scanInterval) {
      this.stopAutoDetection();
    }

    console.log('🔍 Démarrage détection USB automatique...');

    // Premier scan immédiat
    this.scanUSBDevices().then(onDevicesFound);

    // Scan périodique
    this.scanInterval = setInterval(async () => {
      const devices = await this.scanUSBDevices();
      if (devices.length > 0) {
        onDevicesFound(devices);
      }
    }, intervalMs);
  }

  stopAutoDetection(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('🛑 Détection USB arrêtée');
    }
  }

  // =============== CONNEXION ===============

  async connect(device: BR301USBDevice): Promise<boolean> {
    if (!PlatformService.canUseUSB || !this.UsbSerial) {
      console.warn('USB non disponible');
      return false;
    }

    try {
      console.log('📶 Connexion USB à', device.name);

      // Demander la permission pour ce device
      const hasPermission = await this.UsbSerial.requestPermission(device.device.deviceId);
      
      if (!hasPermission) {
        console.error('Permission USB refusée');
        return false;
      }

      // Ouvrir la connexion avec les paramètres bR301
      await this.UsbSerial.open(device.device.deviceId, {
        baudRate: BR301_CONFIG.USB_CONFIG.BAUD_RATE,
        dataBits: BR301_CONFIG.USB_CONFIG.DATA_BITS,
        stopBits: BR301_CONFIG.USB_CONFIG.STOP_BITS,
        parity: BR301_CONFIG.USB_CONFIG.PARITY
      });

      this.connectedDevice = { ...device, connected: true };
      console.log('✅ Connecté via USB');

      return true;

    } catch (error) {
      console.error('Erreur connexion USB:', error);
      return false;
    }
  }

  // =============== COMMUNICATION ===============

  async sendCommand(command: Uint8Array): Promise<Uint8Array> {
    if (!PlatformService.canUseUSB || !this.UsbSerial || !this.connectedDevice) {
      throw new Error('USB non connecté');
    }

    try {
      // Convertir en base64
      let binary = '';
      for (let i = 0; i < command.length; i++) {
        binary += String.fromCharCode(command[i]);
      }
      const commandBase64 = btoa(binary);

      // Envoyer
      await this.UsbSerial.write(commandBase64);

      // Attendre et lire la réponse
      const response = await this.readResponse(5000);
      return response;

    } catch (error) {
      console.error('Erreur envoi commande USB:', error);
      throw error;
    }
  }

  private readResponse(timeoutMs: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout lecture USB'));
      }, timeoutMs);

      try {
        // Écouter les données
        const subscription = this.UsbSerial.onReceived((data: string) => {
          clearTimeout(timeout);
          subscription.remove();
          
          // Convertir de base64
          const binary = atob(data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          resolve(bytes);
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // =============== DÉCONNEXION ===============

  async disconnect(): Promise<void> {
    this.stopAutoDetection();

    if (this.connectedDevice && this.UsbSerial) {
      try {
        await this.UsbSerial.close();
        console.log('Déconnecté USB');
      } catch (error) {
        console.error('Erreur déconnexion USB:', error);
      }
    }

    this.connectedDevice = null;
  }

  // =============== SIMULATION WEB ===============

  private getMockedDevices(): BR301USBDevice[] {
    console.log('📱 Mode web: retour de devices USB simulés');
    return [
      {
        id: 'mock-usb-1',
        name: 'bR301 USB-C (Simulé)',
        connected: false,
        device: {
          deviceId: 1,
          vendorId: 0x096E,
          productId: 0x0622,
          deviceName: 'Feitian bR301'
        }
      }
    ];
  }

  // =============== GETTERS ===============

  isConnected(): boolean {
    return this.connectedDevice !== null && this.connectedDevice.connected;
  }

  getConnectedDevice(): BR301USBDevice | null {
    return this.connectedDevice;
  }

  isAvailable(): boolean {
    return PlatformService.canUseUSB;
  }
}

// Export singleton
export default new BR301UsbService();
