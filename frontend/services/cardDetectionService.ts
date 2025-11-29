/**
 * Card Detection Service - Détection RÉELLE de carte via USB
 * Surveille le lecteur en temps réel pour détecter l'insertion de carte
 */

import usbCardReaderService from './usbCardReaderService';

// Types
export interface CardStatus {
  present: boolean;           // Carte présente ?
  functional: boolean;        // Carte fonctionnelle ?
  atr: string | null;        // ATR (Answer To Reset)
  cardType: string | null;   // Type de carte détecté
  error: string | null;      // Message d'erreur
}

// Commandes APDU PC/SC pour détection
const APDU_COMMANDS = {
  // Get Status - Vérifier l'état du lecteur
  GET_STATUS: new Uint8Array([0xFF, 0x00, 0x00, 0x00, 0x00]),
  
  // Power On - Activer la carte et obtenir ATR
  POWER_ON: new Uint8Array([0xFF, 0x10, 0x00, 0x00, 0x00]),
  
  // Get ATR - Obtenir l'ATR de la carte
  GET_ATR: new Uint8Array([0xFF, 0xCA, 0x00, 0x00, 0x00]),
  
  // Select - Tester communication
  SELECT_TEST: new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x00])
};

class CardDetectionService {
  private detectionInterval: NodeJS.Timeout | null = null;
  private isDetecting: boolean = false;
  private lastStatus: CardStatus | null = null;
  private onCardDetectedCallback: ((status: CardStatus) => void) | null = null;
  private onCardRemovedCallback: (() => void) | null = null;

  // =============== DÉTECTION AUTOMATIQUE ===============

  /**
   * Démarrer la surveillance en continu du lecteur
   * Détecte automatiquement l'insertion/retrait de carte
   */
  startCardDetection(
    onCardDetected: (status: CardStatus) => void,
    onCardRemoved: () => void,
    intervalMs: number = 500 // Vérifier toutes les 500ms
  ) {
    if (this.isDetecting) {
      console.log('Détection déjà en cours');
      return;
    }

    console.log('🔍 Démarrage détection automatique de carte...');
    this.isDetecting = true;
    this.onCardDetectedCallback = onCardDetected;
    this.onCardRemovedCallback = onCardRemoved;

    // Premier check immédiat
    this.checkCardPresence();

    // Check périodique
    this.detectionInterval = setInterval(() => {
      this.checkCardPresence();
    }, intervalMs);
  }

  /**
   * Arrêter la surveillance
   */
  stopCardDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.isDetecting = false;
    this.lastStatus = null;
    console.log('🛑 Détection de carte arrêtée');
  }

  // =============== VÉRIFICATION PRÉSENCE CARTE ===============

  /**
   * Vérifier si une carte est présente dans le lecteur
   */
  private async checkCardPresence() {
    try {
      // Vérifier qu'un lecteur est connecté
      if (!usbCardReaderService.isConnected()) {
        return;
      }

      // Envoyer commande Get Status
      const statusResponse = await this.sendCommand(APDU_COMMANDS.GET_STATUS);
      
      // Analyser la réponse
      const cardStatus = this.analyzeStatusResponse(statusResponse);

      // Comparer avec le statut précédent
      if (this.hasStatusChanged(cardStatus)) {
        if (cardStatus.present && !this.lastStatus?.present) {
          // Carte insérée !
          console.log('✅ Carte détectée !');
          if (this.onCardDetectedCallback) {
            this.onCardDetectedCallback(cardStatus);
          }
        } else if (!cardStatus.present && this.lastStatus?.present) {
          // Carte retirée !
          console.log('❌ Carte retirée');
          if (this.onCardRemovedCallback) {
            this.onCardRemovedCallback();
          }
        }

        this.lastStatus = cardStatus;
      }
    } catch (error) {
      console.error('Erreur vérification carte:', error);
    }
  }

  /**
   * Comparer deux statuts pour détecter changement
   */
  private hasStatusChanged(newStatus: CardStatus): boolean {
    if (!this.lastStatus) return true;
    return this.lastStatus.present !== newStatus.present;
  }

  // =============== COMMANDES APDU ===============

  /**
   * Envoyer une commande APDU au lecteur
   */
  private async sendCommand(command: Uint8Array): Promise<Uint8Array> {
    try {
      const response = await usbCardReaderService.sendCommand(command);
      return response;
    } catch (error) {
      console.error('Erreur envoi commande:', error);
      throw error;
    }
  }

  /**
   * Analyser la réponse du Get Status
   */
  private analyzeStatusResponse(response: Uint8Array): CardStatus {
    // Analyser les bytes de réponse
    // Format typique: [Status Bytes] + [SW1] + [SW2]
    
    const len = response.length;
    if (len < 2) {
      return {
        present: false,
        functional: false,
        atr: null,
        cardType: null,
        error: 'Réponse invalide'
      };
    }

    const sw1 = response[len - 2];
    const sw2 = response[len - 1];

    // SW1=0x90 SW2=0x00 = Succès
    if (sw1 === 0x90 && sw2 === 0x00) {
      // Carte présente et fonctionnelle
      return {
        present: true,
        functional: true,
        atr: null,
        cardType: 'Smart Card',
        error: null
      };
    }

    // SW1=0x62 ou 0x63 = Carte présente mais avertissement
    if (sw1 === 0x62 || sw1 === 0x63) {
      return {
        present: true,
        functional: true,
        atr: null,
        cardType: 'Smart Card',
        error: 'Avertissement carte'
      };
    }

    // SW1=0x6A SW2=0x81 = Fonction non supportée (pas de carte)
    if (sw1 === 0x6A && sw2 === 0x81) {
      return {
        present: false,
        functional: false,
        atr: null,
        cardType: null,
        error: null
      };
    }

    // Autres codes = erreur ou pas de carte
    return {
      present: false,
      functional: false,
      atr: null,
      cardType: null,
      error: `Erreur SW: ${sw1.toString(16)} ${sw2.toString(16)}`
    };
  }

  // =============== OBTENIR ATR ===============

  /**
   * Obtenir l'ATR (Answer To Reset) de la carte
   * L'ATR identifie le type de carte
   */
  async getCardATR(): Promise<string | null> {
    try {
      // Commande Power On pour activer la carte
      const powerResponse = await this.sendCommand(APDU_COMMANDS.POWER_ON);
      
      // L'ATR est dans la réponse (avant les status words)
      const atr = this.extractATR(powerResponse);
      
      if (atr) {
        console.log('ATR reçu:', atr);
        return atr;
      }

      // Sinon, essayer Get ATR
      const atrResponse = await this.sendCommand(APDU_COMMANDS.GET_ATR);
      return this.extractATR(atrResponse);
    } catch (error) {
      console.error('Erreur obtention ATR:', error);
      return null;
    }
  }

  /**
   * Extraire l'ATR des bytes de réponse
   */
  private extractATR(response: Uint8Array): string | null {
    if (response.length < 4) return null;

    // L'ATR est avant les 2 derniers bytes (SW1 SW2)
    const atrBytes = response.slice(0, response.length - 2);
    
    if (atrBytes.length === 0) return null;

    // Convertir en hex string
    return Array.from(atrBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase();
  }

  // =============== VÉRIFICATION FONCTIONNELLE ===============

  /**
   * Tester si la carte répond correctement
   */
  async testCardCommunication(): Promise<boolean> {
    try {
      // Envoyer une commande SELECT simple
      const response = await this.sendCommand(APDU_COMMANDS.SELECT_TEST);
      
      const len = response.length;
      if (len < 2) return false;

      const sw1 = response[len - 2];
      const sw2 = response[len - 1];

      // Succès ou fichier non trouvé (normal pour un test)
      return (sw1 === 0x90 && sw2 === 0x00) || 
             (sw1 === 0x6A && sw2 === 0x82);
    } catch (error) {
      console.error('Erreur test communication:', error);
      return false;
    }
  }

  // =============== DÉTECTION COMPLÈTE ===============

  /**
   * Analyse complète de la carte
   * Appelé automatiquement quand une carte est détectée
   */
  async analyzeCard(): Promise<CardStatus> {
    try {
      console.log('🔍 Analyse de la carte...');

      // 1. Obtenir l'ATR
      const atr = await this.getCardATR();
      
      if (!atr) {
        return {
          present: true,
          functional: false,
          atr: null,
          cardType: null,
          error: 'Impossible de lire l\'ATR'
        };
      }

      // 2. Tester la communication
      const communicates = await this.testCardCommunication();

      // 3. Identifier le type de carte d'après l'ATR
      const cardType = this.identifyCardType(atr);

      return {
        present: true,
        functional: communicates,
        atr: atr,
        cardType: cardType,
        error: communicates ? null : 'Carte ne répond pas'
      };
    } catch (error) {
      console.error('Erreur analyse carte:', error);
      return {
        present: true,
        functional: false,
        atr: null,
        cardType: null,
        error: 'Erreur lors de l\'analyse'
      };
    }
  }

  /**
   * Identifier le type de carte d'après l'ATR
   */
  private identifyCardType(atr: string): string {
    const atrLower = atr.toLowerCase().replace(/\s/g, '');

    // JCOP cards (NXP)
    if (atrLower.includes('3b68') || atrLower.includes('3b80')) {
      return 'JCOP Java Card';
    }

    // Gemalto
    if (atrLower.includes('3b7d') || atrLower.includes('3b7f')) {
      return 'Gemalto Card';
    }

    // MIFARE
    if (atrLower.includes('3b8f') || atrLower.includes('3b8c')) {
      return 'MIFARE Card';
    }

    // Generic
    if (atrLower.startsWith('3b')) {
      return 'ISO 7816 Smart Card';
    }

    return 'Unknown Card Type';
  }

  // =============== MÉTHODE PUBLIQUE POUR DÉTECTION UNIQUE ===============

  /**
   * Vérification unique (sans surveillance continue)
   * Utile pour un check ponctuel
   */
  async checkCardNow(): Promise<CardStatus> {
    try {
      const statusResponse = await this.sendCommand(APDU_COMMANDS.GET_STATUS);
      const status = this.analyzeStatusResponse(statusResponse);

      if (status.present && status.functional) {
        // Analyse complète
        return await this.analyzeCard();
      }

      return status;
    } catch (error) {
      console.error('Erreur check carte:', error);
      return {
        present: false,
        functional: false,
        atr: null,
        cardType: null,
        error: 'Erreur de communication'
      };
    }
  }

  // =============== GETTERS ===============

  isDetecting(): boolean {
    return this.isDetecting;
  }

  getLastStatus(): CardStatus | null {
    return this.lastStatus;
  }
}

// Export singleton
export default new CardDetectionService();
