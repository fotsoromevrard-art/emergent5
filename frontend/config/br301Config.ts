/**
 * Configuration du lecteur Feitian bR301
 * Lecteur de carte à puce USB-C compatible CCID
 */

// Identifiants USB du Feitian bR301
export const BR301_USB = {
  VENDOR_ID: 0x096E,      // Feitian Technologies
  PRODUCT_IDS: [
    0x0622,               // bR301 USB
    0x0624,               // bR301 BLE (mode USB)
    0x0608,               // Autre variante Feitian
  ],
  DEVICE_NAME: 'Feitian bR301',
};

// Configuration série USB
export const USB_SERIAL_CONFIG = {
  BAUD_RATE: 115200,
  DATA_BITS: 8,
  STOP_BITS: 1,
  PARITY: 0,
};

// Commandes CCID (USB Chip Card Interface Device)
export const CCID_COMMANDS = {
  // Messages PC_to_RDR (Host vers lecteur)
  PC_to_RDR_IccPowerOn: 0x62,
  PC_to_RDR_IccPowerOff: 0x63,
  PC_to_RDR_GetSlotStatus: 0x65,
  PC_to_RDR_XfrBlock: 0x6F,
  PC_to_RDR_GetParameters: 0x6C,
  PC_to_RDR_ResetParameters: 0x6D,
  PC_to_RDR_SetParameters: 0x61,
  PC_to_RDR_Escape: 0x6B,
  PC_to_RDR_IccClock: 0x6E,
  PC_to_RDR_T0APDU: 0x6A,
  PC_to_RDR_Secure: 0x69,
  PC_to_RDR_Mechanical: 0x71,
  PC_to_RDR_Abort: 0x72,
  
  // Messages RDR_to_PC (Lecteur vers host)
  RDR_to_PC_DataBlock: 0x80,
  RDR_to_PC_SlotStatus: 0x81,
  RDR_to_PC_Parameters: 0x82,
  RDR_to_PC_Escape: 0x83,
  RDR_to_PC_DataRateAndClockFrequency: 0x84,
};

// ATR (Answer To Reset) connus pour la détection de carte
export const KNOWN_ATR_PATTERNS = {
  // Cartes JCOP (Java Card)
  JCOP_INFINEON: {
    pattern: /^3B.{2}80.{2}4A434F50/i,
    name: 'Carte JCOP (Infineon)',
    type: 'jcop_valid' as const,
    supported: true,
  },
  JCOP_GENERIC: {
    pattern: /^3B.{2}80.{2}(4A|6A)434F50/i,
    name: 'Carte JCOP Générique',
    type: 'jcop_valid' as const,
    supported: true,
  },
  // Cartes vierges
  JCOP_BLANK: {
    pattern: /^3B8980014A434F5076/i,
    name: 'Carte JCOP Vierge (non programmée)',
    type: 'jcop_blank' as const,
    supported: false,
  },
  // Cartes bancaires (non supportées)
  VISA: {
    pattern: /^3B.{2}00.{2}(56495341|A0000000031010)/i,
    name: 'Carte Visa',
    type: 'bank_card' as const,
    supported: false,
  },
  MASTERCARD: {
    pattern: /^3B.{2}00.{2}(4D617374|A0000000041010)/i,
    name: 'Carte Mastercard',
    type: 'bank_card' as const,
    supported: false,
  },
};

// AID (Application Identifier) de votre applet JCOP
export const JCOP_APPLET = {
  // À configurer avec l'AID réel de votre applet
  AID: 'D2760001180002FF49502589',
  NAME: 'Crypto Wallet Applet',
};

// Fonction pour identifier un device bR301
export function isBR301Device(vendorId: number, productId?: number): boolean {
  if (vendorId !== BR301_USB.VENDOR_ID) return false;
  if (productId === undefined) return true;
  return BR301_USB.PRODUCT_IDS.includes(productId);
}

// Fonction pour parser un ATR et identifier le type de carte
export function parseATR(atrHex: string): {
  type: 'jcop_valid' | 'jcop_blank' | 'bank_card' | 'unknown';
  name: string;
  supported: boolean;
} {
  const atr = atrHex.toUpperCase().replace(/\s/g, '');
  
  for (const [key, config] of Object.entries(KNOWN_ATR_PATTERNS)) {
    if (config.pattern.test(atr)) {
      return {
        type: config.type,
        name: config.name,
        supported: config.supported,
      };
    }
  }
  
  return {
    type: 'unknown',
    name: 'Carte inconnue',
    supported: false,
  };
}

export default {
  BR301_USB,
  USB_SERIAL_CONFIG,
  CCID_COMMANDS,
  KNOWN_ATR_PATTERNS,
  JCOP_APPLET,
  isBR301Device,
  parseATR,
};
