/**
 * Service de détection et validation des cartes
 * 
 * Gère la détection de 3 types de cartes :
 * 1. Carte JCOP Infineon SLE78 programmée (avec applet crypto) → ACCEPTÉE
 * 2. Carte JCOP vierge (sans applet) → REJETÉE
 * 3. Carte bancaire Visa/Mastercard → REFUSÉE (non conforme)
 * 
 * Caractéristiques cartes supportées :
 * - NVM totale : 400 Ko
 * - RAM totale : 8 Ko
 * - Puce : Infineon SLE78CLFX4000PM
 * - Certification : CC EAL6+, EMVCo, FIPS 140-2 Level 3
 */

// =============== TYPES ===============

export type CardType = 
  | 'JCOP_PROGRAMMED'    // Carte JCOP avec applet crypto installé
  | 'JCOP_EMPTY'         // Carte JCOP vierge sans applet
  | 'VISA_MASTERCARD'    // Carte bancaire (non conforme)
  | 'UNKNOWN';           // Carte non reconnue

export type CardValidationResult = 
  | 'VALID'              // Carte valide pour paiement
  | 'REJECTED_EMPTY'     // Rejetée: carte vierge
  | 'REJECTED_BANKING'   // Refusée: carte bancaire non conforme
  | 'REJECTED_UNKNOWN';  // Rejetée: carte non reconnue

export interface CardDetectionResult {
  type: CardType;
  validation: CardValidationResult;
  atr: string;
  message: string;
  details: {
    isJCOP: boolean;
    isInfineon: boolean;
    hasApplet: boolean;
    isBankingCard: boolean;
    chipInfo?: string;
  };
}

export interface JCOPCardInfo {
  // Caractéristiques attendues de la carte Infineon SLE78
  nvmTotal: number;      // 400 Ko
  ramTotal: number;      // 8 Ko
  nvmUser: number;       // 138.5 Ko
  ramUser: number;       // 1.84 Ko
  chip: string;          // Infineon SLE78CLFX4000PM
  certificationChip: string;   // CC EAL6+, EMVCo
  certificationOS: string;     // FIPS 140-2 Level 3
}

// =============== CONSTANTES ATR ===============

// Préfixes ATR connus pour identifier les types de cartes
const ATR_PATTERNS = {
  // Cartes JCOP / JavaCard (Infineon, NXP, etc.)
  JCOP_INFINEON: [
    '3B 68',           // Infineon SLE78 series
    '3B 69',           // Infineon variants
    '3B 8F',           // JCOP generic
    '3B 88',           // JCOP 2.4.x
    '3B F8',           // JCOP 3.x
    '3B 7F',           // Infineon contactless
  ],
  
  // Cartes bancaires Visa/Mastercard (EMV)
  VISA_MASTERCARD: [
    '3B 6E',           // Visa cards
    '3B 6D',           // Mastercard cards
    '3B 67',           // EMV banking cards
    '3B 9F',           // EMV chip cards
    '3B 7D',           // Banking cards
    '3B 7E',           // Payment cards
    '3B 6F 00 00 80',  // Visa specific
    '3B 67 00 00 00 00 00 00 00',  // Mastercard specific
  ],
  
  // Identifiants RID des réseaux de paiement (à NE PAS sélectionner)
  PAYMENT_AIDS: [
    'A0 00 00 00 03',  // Visa International
    'A0 00 00 00 04',  // Mastercard
    'A0 00 00 00 05',  // Mastercard (Maestro)
    'A0 00 00 00 25',  // American Express
    'A0 00 00 00 65',  // JCB
    'A0 00 00 01 52',  // Discover
    'A0 00 00 03 33',  // UnionPay
  ]
};

// AID de l'applet wallet crypto (notre applet personnalisé)
const CRYPTO_WALLET_AID = 'A0 00 00 00 62 03 01 0C 06 01';

// =============== CLASSE PRINCIPALE ===============

class CardDetectionService {
  
  /**
   * Analyser l'ATR pour déterminer le type de carte
   */
  analyzeATR(atr: string): {
    isJCOP: boolean;
    isInfineon: boolean;
    isBankingCard: boolean;
    chipType: string | null;
  } {
    const atrClean = atr.toUpperCase().replace(/\s+/g, ' ').trim();
    
    // Vérifier si c'est une carte bancaire Visa/Mastercard
    const isBankingCard = ATR_PATTERNS.VISA_MASTERCARD.some(pattern => 
      atrClean.startsWith(pattern.toUpperCase().replace(/\s+/g, ' '))
    );
    
    if (isBankingCard) {
      return {
        isJCOP: false,
        isInfineon: false,
        isBankingCard: true,
        chipType: this.detectBankingCardType(atrClean)
      };
    }
    
    // Vérifier si c'est une carte JCOP/Infineon
    const isJCOP = ATR_PATTERNS.JCOP_INFINEON.some(pattern =>
      atrClean.startsWith(pattern.toUpperCase().replace(/\s+/g, ' '))
    );
    
    // Détecter spécifiquement Infineon SLE78
    const isInfineon = atrClean.includes('3B 68') || 
                       atrClean.includes('3B 69') ||
                       atrClean.includes('3B 7F');
    
    return {
      isJCOP,
      isInfineon,
      isBankingCard: false,
      chipType: isInfineon ? 'Infineon SLE78CLFX4000PM' : (isJCOP ? 'JCOP Generic' : null)
    };
  }
  
  /**
   * Détecter le type de carte bancaire (pour le message d'erreur)
   */
  private detectBankingCardType(atr: string): string {
    if (atr.includes('3B 6E') || atr.includes('A0 00 00 00 03')) {
      return 'Visa';
    }
    if (atr.includes('3B 6D') || atr.includes('3B 67') || atr.includes('A0 00 00 00 04')) {
      return 'Mastercard';
    }
    if (atr.includes('A0 00 00 00 25')) {
      return 'American Express';
    }
    return 'Carte bancaire EMV';
  }
  
  /**
   * Vérifier si un AID correspond à un réseau de paiement bancaire
   * IMPORTANT: Ne jamais tenter de sélectionner ces AIDs
   */
  isBankingAID(aid: string): boolean {
    const aidClean = aid.toUpperCase().replace(/\s+/g, ' ').trim();
    return ATR_PATTERNS.PAYMENT_AIDS.some(pattern =>
      aidClean.startsWith(pattern.toUpperCase().replace(/\s+/g, ' '))
    );
  }
  
  /**
   * Détecter et valider une carte insérée
   * @param atr - L'ATR de la carte
   * @param hasWalletApplet - Résultat de la tentative de sélection de l'applet crypto
   */
  detectAndValidate(atr: string, hasWalletApplet: boolean): CardDetectionResult {
    const analysis = this.analyzeATR(atr);
    
    // CAS 1: Carte bancaire Visa/Mastercard → REFUS IMMÉDIAT
    if (analysis.isBankingCard) {
      return {
        type: 'VISA_MASTERCARD',
        validation: 'REJECTED_BANKING',
        atr: atr,
        message: `🚫 CARTE NON CONFORME\n\nCette carte ${analysis.chipType} n'est pas compatible avec le système de paiement crypto.\n\nSeules les cartes programmées avec l'applet wallet crypto sont acceptées.`,
        details: {
          isJCOP: false,
          isInfineon: false,
          hasApplet: false,
          isBankingCard: true,
          chipInfo: analysis.chipType || undefined
        }
      };
    }
    
    // CAS 2: Carte JCOP sans applet → REJET
    if (analysis.isJCOP && !hasWalletApplet) {
      return {
        type: 'JCOP_EMPTY',
        validation: 'REJECTED_EMPTY',
        atr: atr,
        message: `❌ CARTE NON PROGRAMMÉE\n\nCette carte ${analysis.isInfineon ? 'Infineon SLE78' : 'JCOP'} n'a pas été programmée avec l'applet wallet crypto.\n\nVeuillez utiliser une carte configurée via l'écosystème crypto.`,
        details: {
          isJCOP: true,
          isInfineon: analysis.isInfineon,
          hasApplet: false,
          isBankingCard: false,
          chipInfo: analysis.chipType || undefined
        }
      };
    }
    
    // CAS 3: Carte JCOP avec applet → ACCEPTÉE
    if (analysis.isJCOP && hasWalletApplet) {
      return {
        type: 'JCOP_PROGRAMMED',
        validation: 'VALID',
        atr: atr,
        message: `✅ CARTE VALIDE\n\nCarte ${analysis.isInfineon ? 'Infineon SLE78' : 'JCOP'} avec applet crypto détecté.`,
        details: {
          isJCOP: true,
          isInfineon: analysis.isInfineon,
          hasApplet: true,
          isBankingCard: false,
          chipInfo: analysis.chipType || undefined
        }
      };
    }
    
    // CAS 4: Carte inconnue → REJET
    return {
      type: 'UNKNOWN',
      validation: 'REJECTED_UNKNOWN',
      atr: atr,
      message: `⚠️ CARTE NON RECONNUE\n\nCette carte n'est pas reconnue par le système.\n\nATR: ${atr}\n\nUtilisez une carte JCOP Infineon SLE78 programmée.`,
      details: {
        isJCOP: false,
        isInfineon: false,
        hasApplet: false,
        isBankingCard: false
      }
    };
  }
  
  /**
   * Obtenir les caractéristiques attendues de la carte Infineon SLE78
   */
  getExpectedCardSpecs(): JCOPCardInfo {
    return {
      nvmTotal: 400,           // Ko
      ramTotal: 8,             // Ko
      nvmUser: 138.5,          // Ko
      ramUser: 1.84,           // Ko
      chip: 'Infineon SLE78CLFX4000PM',
      certificationChip: 'CC EAL6+, EMVCo',
      certificationOS: 'FIPS 140-2 Level 3'
    };
  }
  
  /**
   * Obtenir le message d'erreur approprié selon le type de rejet
   */
  getErrorMessage(validation: CardValidationResult): {
    title: string;
    message: string;
    icon: string;
  } {
    switch (validation) {
      case 'REJECTED_BANKING':
        return {
          title: 'Carte bancaire détectée',
          message: 'Les cartes Visa, Mastercard et autres cartes bancaires ne sont pas compatibles avec ce terminal.\n\nUtilisez uniquement une carte crypto programmée.',
          icon: 'card-outline'
        };
        
      case 'REJECTED_EMPTY':
        return {
          title: 'Carte non programmée',
          message: 'Cette carte JCOP n\'a pas été configurée avec l\'applet wallet crypto.\n\nContactez votre fournisseur pour programmer la carte.',
          icon: 'alert-circle-outline'
        };
        
      case 'REJECTED_UNKNOWN':
        return {
          title: 'Carte non reconnue',
          message: 'Cette carte n\'est pas compatible avec le système.\n\nUtilisez une carte Infineon SLE78 programmée.',
          icon: 'help-circle-outline'
        };
        
      default:
        return {
          title: 'Erreur',
          message: 'Une erreur est survenue lors de la lecture de la carte.',
          icon: 'close-circle-outline'
        };
    }
  }
  
  /**
   * Vérifier si l'ATR correspond à une carte Infineon SLE78
   */
  isInfineonSLE78(atr: string): boolean {
    const atrClean = atr.toUpperCase().replace(/\s+/g, ' ');
    // ATR typiques des Infineon SLE78
    return atrClean.startsWith('3B 68') || 
           atrClean.startsWith('3B 69') ||
           atrClean.startsWith('3B 7F') ||
           atrClean.includes('SLE78');
  }
  
  /**
   * Formater l'ATR pour affichage
   */
  formatATR(atr: string): string {
    return atr.toUpperCase()
      .replace(/[^0-9A-F]/g, '')
      .match(/.{1,2}/g)
      ?.join(' ') || atr;
  }
}

// Export singleton
export default new CardDetectionService();

// Export des constantes pour utilisation externe
export { ATR_PATTERNS, CRYPTO_WALLET_AID };
