/**
 * Service de lecteur de carte unifié
 * 
 * Ce service fournit une interface unifiée pour :
 * - Le mode USB réel (sur APK custom Android)
 * - Le mode simulation (sur Expo Go / Web)
 * 
 * Il détecte automatiquement l'environnement et utilise
 * le bon backend.
 */

import { Platform } from 'react-native';
import { PlatformService } from './platformService';
import usbService, { USBDevice, initUSBModule } from './usbService';
import { parseATR, JCOP_APPLET } from '../config/br301Config';

// Types
export interface CardReaderDevice {
  id: string;
  name: string;
  type: 'usb' | 'simulation';
  connected: boolean;
  usbDevice?: USBDevice;
}

export interface CardInfo {
  present: boolean;
  atr: string | null;
  type: 'jcop_valid' | 'jcop_blank' | 'bank_card' | 'unknown' | null;
  typeName: string;
  supported: boolean;
}

export interface APDUResult {
  success: boolean;
  data: Uint8Array;
  sw1: number;
  sw2: number;
  statusWord: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  signature?: string;
  error?: string;
}

// État du service
let isInitialized = false;
let isUSBMode = false;

/**
 * Initialise le service de lecture de carte
 * Détecte automatiquement le mode (USB ou simulation)
 */
export async function initCardReader(): Promise<{ mode: 'usb' | 'simulation' }> {
  if (isInitialized) {
    return { mode: isUSBMode ? 'usb' : 'simulation' };
  }

  // Essayer d'initialiser l'USB sur Android
  if (PlatformService.isAndroid) {
    const usbAvailable = await initUSBModule();
    if (usbAvailable) {
      isUSBMode = true;
      console.log('✅ Mode USB activé');
    }
  }

  isInitialized = true;
  
  if (!isUSBMode) {
    console.log('ℹ️ Mode simulation activé (USB non disponible)');
  }

  return { mode: isUSBMode ? 'usb' : 'simulation' };
}

class CardReaderService {
  private connectedReader: CardReaderDevice | null = null;
  private currentCard: CardInfo | null = null;

  /**
   * Vérifie si le mode USB est disponible
   */
  isUSBAvailable(): boolean {
    return isUSBMode;
  }

  /**
   * Retourne le mode actuel
   */
  getMode(): 'usb' | 'simulation' {
    return isUSBMode ? 'usb' : 'simulation';
  }

  /**
   * Recherche les lecteurs de carte disponibles
   */
  async scanForReaders(): Promise<CardReaderDevice[]> {
    const readers: CardReaderDevice[] = [];

    // Mode USB réel
    if (isUSBMode) {
      try {
        const usbDevices = await usbService.findBR301Devices();
        for (const device of usbDevices) {
          readers.push({
            id: `usb-${device.deviceId}`,
            name: device.productName || device.deviceName || 'Feitian bR301',
            type: 'usb',
            connected: false,
            usbDevice: device,
          });
        }
      } catch (error) {
        console.error('Erreur scan USB:', error);
      }
    }

    // Ajouter un lecteur simulé si aucun USB trouvé ou si pas en mode USB
    if (readers.length === 0) {
      await this.delay(1500); // Simuler le temps de scan
      readers.push({
        id: 'sim-br301',
        name: 'Feitian bR301 (Simulation)',
        type: 'simulation',
        connected: false,
      });
    }

    return readers;
  }

  /**
   * Connexion à un lecteur
   */
  async connect(reader: CardReaderDevice): Promise<boolean> {
    try {
      if (reader.type === 'usb' && reader.usbDevice) {
        // Connexion USB réelle
        const result = await usbService.connect(reader.usbDevice);
        if (result.connected) {
          this.connectedReader = { ...reader, connected: true };
          console.log('✅ Connecté au lecteur USB:', reader.name);
          return true;
        } else {
          console.error('Erreur connexion USB:', result.error);
          return false;
        }
      } else {
        // Mode simulation
        await this.delay(1000);
        this.connectedReader = { ...reader, connected: true };
        console.log('✅ Connecté au lecteur (simulation):', reader.name);
        return true;
      }
    } catch (error) {
      console.error('Erreur connexion:', error);
      return false;
    }
  }

  /**
   * Déconnexion du lecteur
   */
  async disconnect(): Promise<void> {
    if (this.connectedReader?.type === 'usb') {
      await usbService.disconnect();
    }
    this.connectedReader = null;
    this.currentCard = null;
    console.log('🔌 Lecteur déconnecté');
  }

  /**
   * Vérifie si connecté
   */
  isConnected(): boolean {
    return this.connectedReader !== null && this.connectedReader.connected;
  }

  /**
   * Obtient le lecteur connecté
   */
  getConnectedReader(): CardReaderDevice | null {
    return this.connectedReader;
  }

  /**
   * Vérifie la présence d'une carte et l'identifie
   */
  async checkCard(): Promise<CardInfo> {
    if (!this.isConnected()) {
      return {
        present: false,
        atr: null,
        type: null,
        typeName: 'Lecteur non connecté',
        supported: false,
      };
    }

    try {
      if (this.connectedReader?.type === 'usb') {
        // Mode USB réel
        const status = await usbService.getSlotStatus();
        
        if (!status.cardPresent) {
          return {
            present: false,
            atr: null,
            type: null,
            typeName: 'Aucune carte détectée',
            supported: false,
          };
        }

        // Power on pour obtenir l'ATR
        const powerResult = await usbService.powerOnCard();
        
        if (powerResult.success && powerResult.atr) {
          const cardType = parseATR(powerResult.atr);
          this.currentCard = {
            present: true,
            atr: powerResult.atr,
            type: cardType.type,
            typeName: cardType.name,
            supported: cardType.supported,
          };
          return this.currentCard;
        }

        return {
          present: true,
          atr: null,
          type: 'unknown',
          typeName: 'Carte non reconnue',
          supported: false,
        };
      } else {
        // Mode simulation
        await this.delay(500);
        
        // Simuler une carte JCOP valide
        this.currentCard = {
          present: true,
          atr: '3B8980014A434F50323431D700',
          type: 'jcop_valid',
          typeName: 'Carte JCOP (Infineon)',
          supported: true,
        };
        return this.currentCard;
      }
    } catch (error) {
      console.error('Erreur détection carte:', error);
      return {
        present: false,
        atr: null,
        type: null,
        typeName: 'Erreur de lecture',
        supported: false,
      };
    }
  }

  /**
   * Sélectionne l'applet JCOP sur la carte
   */
  async selectApplet(): Promise<APDUResult> {
    if (!this.isConnected() || !this.currentCard?.supported) {
      return {
        success: false,
        data: new Uint8Array(),
        sw1: 0x6A,
        sw2: 0x82,
        statusWord: '6A82', // File not found
      };
    }

    try {
      if (this.connectedReader?.type === 'usb') {
        // Commande SELECT APDU
        const aidBytes = this.hexToBytes(JCOP_APPLET.AID);
        const selectAPDU = new Uint8Array([
          0x00,             // CLA
          0xA4,             // INS (SELECT)
          0x04,             // P1 (Select by DF name)
          0x00,             // P2
          aidBytes.length,  // Lc
          ...aidBytes,      // AID
          0x00,             // Le
        ]);

        const result = await usbService.sendAPDU(selectAPDU);
        return {
          success: result.sw1 === 0x90 && result.sw2 === 0x00,
          data: result.data,
          sw1: result.sw1,
          sw2: result.sw2,
          statusWord: result.sw1.toString(16).padStart(2, '0') + 
                     result.sw2.toString(16).padStart(2, '0'),
        };
      } else {
        // Simulation
        await this.delay(300);
        return {
          success: true,
          data: new Uint8Array(),
          sw1: 0x90,
          sw2: 0x00,
          statusWord: '9000',
        };
      }
    } catch (error) {
      console.error('Erreur SELECT:', error);
      return {
        success: false,
        data: new Uint8Array(),
        sw1: 0x6F,
        sw2: 0x00,
        statusWord: '6F00',
      };
    }
  }

  /**
   * Traite un paiement via la carte
   */
  async processPayment(
    amount: number,
    currency: string,
    merchantAddress: string
  ): Promise<PaymentResult> {
    if (!this.isConnected()) {
      return { success: false, error: 'Lecteur non connecté' };
    }

    if (!this.currentCard?.supported) {
      return { success: false, error: 'Carte non supportée' };
    }

    try {
      console.log(`💳 Traitement paiement: ${amount} ${currency}`);
      console.log(`📍 Vers: ${merchantAddress}`);

      if (this.connectedReader?.type === 'usb') {
        // === MODE USB RÉEL ===
        
        // 1. Sélectionner l'applet
        const selectResult = await this.selectApplet();
        if (!selectResult.success) {
          return { success: false, error: 'Impossible de sélectionner l\'applet' };
        }

        // 2. Préparer les données de transaction
        const txData = this.prepareTransactionData(amount, currency, merchantAddress);

        // 3. Envoyer la commande SIGN au portefeuille JCOP
        // Format: CLA INS P1 P2 Lc Data Le
        const signAPDU = new Uint8Array([
          0x80,             // CLA (propriétaire)
          0x20,             // INS (SIGN - à adapter selon votre applet)
          0x00,             // P1
          0x00,             // P2
          txData.length,    // Lc
          ...txData,        // Données de transaction
          0x00,             // Le (longueur attendue)
        ]);

        const signResult = await usbService.sendAPDU(signAPDU);
        
        if (signResult.sw1 === 0x90 && signResult.sw2 === 0x00) {
          // Signature réussie
          const signature = this.bytesToHex(signResult.data);
          const txHash = this.generateTxHash(signature);
          
          return {
            success: true,
            txHash,
            signature,
          };
        } else {
          return {
            success: false,
            error: `Erreur carte: ${signResult.statusWord}`,
          };
        }
      } else {
        // === MODE SIMULATION ===
        await this.delay(2000);
        
        const txHash = '0x' + this.generateRandomHex(64);
        const signature = '0x' + this.generateRandomHex(130);
        
        return {
          success: true,
          txHash,
          signature,
        };
      }
    } catch (error: any) {
      console.error('Erreur paiement:', error);
      return {
        success: false,
        error: error.message || 'Erreur de paiement',
      };
    }
  }

  /**
   * Éteint la carte (power off)
   */
  async powerOffCard(): Promise<void> {
    if (this.connectedReader?.type === 'usb') {
      await usbService.powerOffCard();
    }
    this.currentCard = null;
  }

  // =============== HELPERS PRIVÉS ===============

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private prepareTransactionData(
    amount: number,
    currency: string,
    merchantAddress: string
  ): Uint8Array {
    // Format des données de transaction (à adapter selon votre applet)
    // Structure: [amount (8 bytes)] [currency (4 bytes)] [address (20 bytes)]
    const data = new Uint8Array(32);
    
    // Amount en BigInt (8 bytes, little-endian)
    const amountBig = BigInt(Math.floor(amount * 1e18));
    const amountBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      amountBytes[i] = Number((amountBig >> BigInt(i * 8)) & BigInt(0xFF));
    }
    data.set(amountBytes, 0);

    // Currency code (4 bytes)
    const currencyCode = this.stringToBytes(currency.substring(0, 4).padEnd(4, ' '));
    data.set(currencyCode, 8);

    // Merchant address (20 bytes - adresse Ethereum sans 0x)
    const addressBytes = this.hexToBytes(merchantAddress.replace('0x', '').substring(0, 40));
    data.set(addressBytes, 12);

    return data;
  }

  private generateTxHash(signature: string): string {
    // Générer un hash basé sur la signature
    // En production, ce serait le vrai hash de transaction blockchain
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      hash = ((hash << 5) - hash) + signature.charCodeAt(i);
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
  }

  private generateRandomHex(length: number): string {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace(/\s/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private stringToBytes(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  }
}

// Export singleton
const cardReaderService = new CardReaderService();
export default cardReaderService;
