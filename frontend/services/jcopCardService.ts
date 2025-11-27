/**
 * JCOP Card Service - Gestion des cartes à puce Java Card
 * Support: USB et Bluetooth
 */

import { Platform, PermissionsAndroid } from 'react-native';

// Types
export interface CardReader {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth';
  connected: boolean;
  device?: any;
}

export interface APDUCommand {
  cla: number; // Class byte
  ins: number; // Instruction byte
  p1: number;  // Parameter 1
  p2: number;  // Parameter 2
  data?: number[]; // Data bytes
  le?: number; // Expected response length
}

export interface APDUResponse {
  data: number[];
  sw1: number; // Status word 1
  sw2: number; // Status word 2
  success: boolean;
}

export interface WalletInfo {
  address: string;
  balance: number;
  currency: string;
}

// Constantes APDU pour JCOP
const APDU_CLA = 0x00;
const APDU_SELECT = 0xA4;
const APDU_GET_DATA = 0xCA;
const APDU_PUT_DATA = 0xDA;
const APDU_VERIFY = 0x20;

// AID pour l'applet de wallet (à personnaliser selon votre applet JCOP)
const WALLET_APPLET_AID = [0xA0, 0x00, 0x00, 0x00, 0x62, 0x03, 0x01, 0x0C, 0x06, 0x01];

class JCOPCardService {
  private connectedReader: CardReader | null = null;

  constructor() {
    // Service prêt pour intégration hardware
  }

  // =============== GESTION DES PERMISSIONS ===============

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
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
        console.error('Erreur permissions:', err);
        return false;
      }
    }
    return true;
  }

  // =============== DÉCOUVERTE DES LECTEURS ===============

  async scanForReaders(timeoutMs: number = 10000): Promise<CardReader[]> {
    const readers: CardReader[] = [];

    // Vérifier les permissions
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Permissions Bluetooth refusées');
    }

    // Scanner les lecteurs Bluetooth
    return new Promise((resolve, reject) => {
      const bleManager = this.getBleManager();
      
      const timeout = setTimeout(() => {
        bleManager.stopDeviceScan();
        resolve(readers);
      }, timeoutMs);

      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          bleManager.stopDeviceScan();
          reject(error);
          return;
        }

        if (device && device.name) {
          // Filtrer les lecteurs de carte (mots-clés courants)
          const isCardReader = 
            device.name.toLowerCase().includes('acr') ||
            device.name.toLowerCase().includes('card') ||
            device.name.toLowerCase().includes('reader') ||
            device.name.toLowerCase().includes('feitian') ||
            device.name.toLowerCase().includes('omnikey');

          if (isCardReader) {
            const reader: CardReader = {
              id: device.id,
              name: device.name,
              type: 'bluetooth',
              connected: false,
              device: device
            };

            // Éviter les doublons
            if (!readers.find(r => r.id === reader.id)) {
              readers.push(reader);
            }
          }
        }
      });
    });
  }

  // =============== CONNEXION AU LECTEUR ===============

  async connectToReader(reader: CardReader): Promise<boolean> {
    try {
      if (reader.type === 'bluetooth') {
        return await this.connectBluetooth(reader);
      } else if (reader.type === 'usb') {
        return await this.connectUSB(reader);
      }
      return false;
    } catch (error) {
      console.error('Erreur connexion lecteur:', error);
      return false;
    }
  }

  private async connectBluetooth(reader: CardReader): Promise<boolean> {
    try {
      if (!reader.device) return false;

      // Connexion au device
      const device = await reader.device.connect();
      await device.discoverAllServicesAndCharacteristics();

      this.bluetoothDevice = device;
      this.connectedReader = { ...reader, connected: true };

      console.log('Lecteur Bluetooth connecté:', reader.name);
      return true;
    } catch (error) {
      console.error('Erreur connexion Bluetooth:', error);
      return false;
    }
  }

  private async connectUSB(reader: CardReader): Promise<boolean> {
    // TODO: Implémentation USB via module natif
    // Pour l'instant, simulation
    console.log('Connexion USB simulée pour:', reader.name);
    this.connectedReader = { ...reader, connected: true };
    return true;
  }

  // =============== COMMUNICATION APDU ===============

  async sendAPDU(command: APDUCommand): Promise<APDUResponse> {
    if (!this.connectedReader) {
      throw new Error('Aucun lecteur connecté');
    }

    // Construire la commande APDU
    const apduBytes = this.buildAPDU(command);

    // Envoyer selon le type de connexion
    if (this.connectedReader.type === 'bluetooth') {
      return await this.sendAPDUBluetooth(apduBytes);
    } else {
      return await this.sendAPDUUSB(apduBytes);
    }
  }

  private buildAPDU(command: APDUCommand): number[] {
    const apdu: number[] = [command.cla, command.ins, command.p1, command.p2];

    if (command.data && command.data.length > 0) {
      apdu.push(command.data.length);
      apdu.push(...command.data);
    }

    if (command.le !== undefined) {
      apdu.push(command.le);
    }

    return apdu;
  }

  private async sendAPDUBluetooth(apduBytes: number[]): Promise<APDUResponse> {
    try {
      if (!this.bluetoothDevice) {
        throw new Error('Device Bluetooth non connecté');
      }

      // TODO: Trouver la bonne caractéristique pour envoyer les APDU
      // Cela dépend du lecteur spécifique
      // Exemple générique:
      const services = await this.bluetoothDevice.services();
      
      // Pour l'instant, simulation
      const response = await this.simulateAPDUResponse(apduBytes);
      return response;
    } catch (error) {
      console.error('Erreur envoi APDU Bluetooth:', error);
      throw error;
    }
  }

  private async sendAPDUUSB(apduBytes: number[]): Promise<APDUResponse> {
    // TODO: Implémentation via module natif USB
    // Pour l'instant, simulation
    return await this.simulateAPDUResponse(apduBytes);
  }

  // Simulation pour les tests
  private async simulateAPDUResponse(apduBytes: number[]): Promise<APDUResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simuler une réponse success
    return {
      data: [0x90, 0x00], // Exemple de données
      sw1: 0x90,
      sw2: 0x00,
      success: true
    };
  }

  // =============== OPÉRATIONS CARTE JCOP ===============

  /**
   * Sélectionner l'applet wallet sur la carte JCOP
   */
  async selectWalletApplet(): Promise<boolean> {
    try {
      const command: APDUCommand = {
        cla: APDU_CLA,
        ins: APDU_SELECT,
        p1: 0x04,
        p2: 0x00,
        data: WALLET_APPLET_AID,
        le: 0
      };

      const response = await this.sendAPDU(command);
      return response.success && response.sw1 === 0x90 && response.sw2 === 0x00;
    } catch (error) {
      console.error('Erreur sélection applet:', error);
      return false;
    }
  }

  /**
   * Lire l'adresse du wallet depuis la carte
   */
  async readWalletAddress(): Promise<string | null> {
    try {
      // D'abord sélectionner l'applet
      const selected = await this.selectWalletApplet();
      if (!selected) {
        throw new Error('Impossible de sélectionner l\'applet wallet');
      }

      // Lire l'adresse (tag 0x5F pour l'exemple)
      const command: APDUCommand = {
        cla: APDU_CLA,
        ins: APDU_GET_DATA,
        p1: 0x00,
        p2: 0x5F, // Tag pour l'adresse
        le: 42 // Longueur attendue (adresse Ethereum)
      };

      const response = await this.sendAPDU(command);
      
      if (response.success && response.data.length > 0) {
        // Convertir les bytes en adresse hexadécimale
        const address = '0x' + response.data
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        return address;
      }

      return null;
    } catch (error) {
      console.error('Erreur lecture adresse wallet:', error);
      return null;
    }
  }

  /**
   * Lire le solde du wallet depuis la carte
   */
  async readWalletBalance(): Promise<number | null> {
    try {
      // Commande pour lire le solde (tag 0x9F pour l'exemple)
      const command: APDUCommand = {
        cla: APDU_CLA,
        ins: APDU_GET_DATA,
        p1: 0x00,
        p2: 0x9F, // Tag pour le solde
        le: 8 // 8 bytes pour un nombre
      };

      const response = await this.sendAPDU(command);
      
      if (response.success && response.data.length > 0) {
        // Convertir les bytes en nombre
        let balance = 0;
        for (let i = 0; i < response.data.length; i++) {
          balance = (balance << 8) | response.data[i];
        }
        return balance / 100; // Diviser par 100 si stocké en centimes
      }

      return null;
    } catch (error) {
      console.error('Erreur lecture solde:', error);
      return null;
    }
  }

  /**
   * Vérifier le PIN de la carte
   */
  async verifyPIN(pin: string): Promise<boolean> {
    try {
      // Convertir le PIN en bytes
      const pinBytes = pin.split('').map(c => c.charCodeAt(0));

      const command: APDUCommand = {
        cla: APDU_CLA,
        ins: APDU_VERIFY,
        p1: 0x00,
        p2: 0x00,
        data: pinBytes
      };

      const response = await this.sendAPDU(command);
      return response.success && response.sw1 === 0x90 && response.sw2 === 0x00;
    } catch (error) {
      console.error('Erreur vérification PIN:', error);
      return false;
    }
  }

  /**
   * Signer une transaction avec la carte
   */
  async signTransaction(txData: string): Promise<string | null> {
    try {
      // Convertir les données de transaction en bytes
      const dataBytes = Array.from(Buffer.from(txData, 'hex'));

      // Commande de signature (instruction personnalisée selon votre applet)
      const command: APDUCommand = {
        cla: 0x80, // CLA propriétaire
        ins: 0x2A, // INS pour signature
        p1: 0x00,
        p2: 0x00,
        data: dataBytes,
        le: 64 // Longueur signature attendue
      };

      const response = await this.sendAPDU(command);
      
      if (response.success && response.data.length > 0) {
        // Convertir la signature en hex
        const signature = response.data
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        return signature;
      }

      return null;
    } catch (error) {
      console.error('Erreur signature transaction:', error);
      return null;
    }
  }

  /**
   * Débiter le wallet sur la carte
   */
  async debitWallet(amount: number): Promise<boolean> {
    try {
      // Convertir le montant en bytes (8 bytes)
      const amountCents = Math.floor(amount * 100);
      const amountBytes: number[] = [];
      for (let i = 7; i >= 0; i--) {
        amountBytes.push((amountCents >> (i * 8)) & 0xFF);
      }

      const command: APDUCommand = {
        cla: 0x80,
        ins: 0x30, // INS pour débit
        p1: 0x00,
        p2: 0x00,
        data: amountBytes
      };

      const response = await this.sendAPDU(command);
      return response.success && response.sw1 === 0x90 && response.sw2 === 0x00;
    } catch (error) {
      console.error('Erreur débit wallet:', error);
      return false;
    }
  }

  // =============== FLUX COMPLET DE PAIEMENT ===============

  async processPayment(amount: number, currency: string): Promise<WalletInfo | null> {
    try {
      console.log('Début processus paiement...');

      // 1. Sélectionner l'applet
      const selected = await this.selectWalletApplet();
      if (!selected) {
        throw new Error('Échec sélection applet');
      }

      // 2. Lire l'adresse du wallet
      const address = await this.readWalletAddress();
      if (!address) {
        throw new Error('Impossible de lire l\'adresse wallet');
      }

      // 3. Lire le solde
      const balance = await this.readWalletBalance();
      if (balance === null) {
        throw new Error('Impossible de lire le solde');
      }

      // 4. Vérifier le solde suffisant
      if (balance < amount) {
        throw new Error('Solde insuffisant');
      }

      // 5. Débiter le wallet
      const debited = await this.debitWallet(amount);
      if (!debited) {
        throw new Error('Échec du débit');
      }

      // 6. Lire le nouveau solde
      const newBalance = await this.readWalletBalance();

      return {
        address: address,
        balance: newBalance || 0,
        currency: currency
      };
    } catch (error) {
      console.error('Erreur processus paiement:', error);
      return null;
    }
  }

  // =============== DÉCONNEXION ===============

  async disconnect(): Promise<void> {
    try {
      if (this.bluetoothDevice) {
        await this.bluetoothDevice.cancelConnection();
        this.bluetoothDevice = null;
      }

      this.connectedReader = null;
      console.log('Lecteur déconnecté');
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
}

// Export singleton
export default new JCOPCardService();
