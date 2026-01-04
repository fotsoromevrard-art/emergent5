/**
 * Service de lecteur de carte (Mode Démonstration)
 * 
 * Ce service simule les interactions avec un lecteur de carte
 * pour permettre de tester le flux complet de l'application.
 * 
 * En production (APK custom), ce service serait remplacé par
 * une implémentation réelle utilisant des modules natifs.
 */

import { PlatformService } from './platformService';

// Types
export interface CardReaderDevice {
  id: string;
  name: string;
  type: 'usb' | 'demo';
  connected: boolean;
}

export interface CardInfo {
  present: boolean;
  atr: string | null;
  type: 'jcop_valid' | 'jcop_blank' | 'bank_card' | 'unknown' | null;
  message: string;
}

export interface APDUResponse {
  data: Uint8Array;
  sw1: number;
  sw2: number;
  success: boolean;
}

// ATR connus pour la simulation
const KNOWN_ATRS = {
  JCOP_VALID: '3B8980014A434F50323431D700',
  JCOP_BLANK: '3B8980014A434F5076323431',
  VISA: '3B6700000056495341',
  MASTERCARD: '3B67000000A909004D6173746572436172'
};

class CardReaderService {
  private isConnected: boolean = false;
  private currentDevice: CardReaderDevice | null = null;
  private simulatedCardType: CardInfo['type'] = null;

  /**
   * Recherche les lecteurs disponibles (simulation)
   */
  async scanForReaders(): Promise<CardReaderDevice[]> {
    // Simuler un délai de recherche
    await this.delay(1500);

    // En mode démo, toujours retourner un lecteur simulé
    return [
      {
        id: 'demo-br301-001',
        name: 'Feitian bR301 (Démo)',
        type: 'demo',
        connected: false
      }
    ];
  }

  /**
   * Connexion au lecteur
   */
  async connect(device: CardReaderDevice): Promise<boolean> {
    await this.delay(1000);
    
    this.currentDevice = device;
    this.isConnected = true;
    
    console.log('✅ Connecté au lecteur (mode démo):', device.name);
    return true;
  }

  /**
   * Déconnexion du lecteur
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.currentDevice = null;
    this.simulatedCardType = null;
    console.log('🔌 Lecteur déconnecté');
  }

  /**
   * Vérifie si une carte est présente (simulation)
   */
  async checkCard(): Promise<CardInfo> {
    if (!this.isConnected) {
      return {
        present: false,
        atr: null,
        type: null,
        message: 'Lecteur non connecté'
      };
    }

    // Pour la démo, simuler une carte JCOP valide après quelques secondes
    await this.delay(500);

    // Simuler la détection d'une carte valide
    return {
      present: true,
      atr: KNOWN_ATRS.JCOP_VALID,
      type: 'jcop_valid',
      message: 'Carte JCOP détectée - Prête pour le paiement'
    };
  }

  /**
   * Simule différents types de carte pour le test
   */
  setSimulatedCardType(type: CardInfo['type']): void {
    this.simulatedCardType = type;
  }

  /**
   * Exécute une commande APDU (simulation)
   */
  async sendAPDU(command: Uint8Array): Promise<APDUResponse> {
    await this.delay(300);
    
    // Réponse simulée réussie (SW 90 00)
    return {
      data: new Uint8Array([]),
      sw1: 0x90,
      sw2: 0x00,
      success: true
    };
  }

  /**
   * Simule une transaction de paiement
   */
  async processPayment(amount: number, currency: string): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Lecteur non connecté'
      };
    }

    console.log(`💳 Traitement du paiement: ${amount} ${currency}`);
    
    // Simuler le temps de traitement
    await this.delay(2000);

    // Générer un hash de transaction simulé
    const txHash = '0x' + this.generateRandomHex(64);

    return {
      success: true,
      txHash
    };
  }

  /**
   * Vérifie si le mode démo est actif
   */
  isDemoMode(): boolean {
    return PlatformService.isDemoMode;
  }

  /**
   * État de connexion
   */
  isReaderConnected(): boolean {
    return this.isConnected;
  }

  // === HELPERS PRIVÉS ===

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRandomHex(length: number): string {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

// Export singleton
const cardReaderService = new CardReaderService();
export default cardReaderService;
