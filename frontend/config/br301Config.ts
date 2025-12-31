/**
 * Configuration spécifique pour Feitian bR301-BLE
 * Lecteur de carte à puce Bluetooth BLE + USB-C
 */

// Informations du lecteur
export const BR301_CONFIG = {
  // Identification
  NAME: 'bR301-BLE',
  VENDOR: 'Feitian',
  VENDOR_ID_USB: 0x096E,  // Feitian Technologies
  PRODUCT_ID_USB: 0x0622,  // bR301 USB
  
  // Bluetooth BLE
  BLE_NAME_PREFIX: 'bR301',
  BLE_NAME_ALTERNATIVES: ['BR301', 'Feitian', 'FT'],
  
  // Caractéristiques techniques
  SUPPORTS: {
    ISO_7816: true,
    CONTACT_CARDS: true,
    T0_PROTOCOL: true,
    T1_PROTOCOL: true,
    CLASS_A: true,
    CLASS_B: true,
    CLASS_C: true,
    PCSC_COMPLIANT: true,
    CCID_COMPLIANT: true,
    BLE: true,
    USB_C: true
  },
  
  // Configuration Bluetooth
  BLE_CONFIG: {
    // Services GATT (à découvrir avec votre lecteur)
    SERVICE_UUID: null,  // À déterminer avec le lecteur réel
    WRITE_CHARACTERISTIC: null,
    READ_CHARACTERISTIC: null,
    NOTIFY_CHARACTERISTIC: null,
    
    // Paramètres de connexion
    MTU: 512,
    TIMEOUT: 10000,
    SCAN_TIMEOUT: 15000
  },
  
  // Configuration USB
  USB_CONFIG: {
    BAUD_RATE: 9600,
    DATA_BITS: 8,
    STOP_BITS: 1,
    PARITY: 0,
    FLOW_CONTROL: false
  },
  
  // Commandes APDU spécifiques
  APDU_COMMANDS: {
    // Commandes PC/SC CCID standard
    GET_STATUS: [0xFF, 0x00, 0x00, 0x00, 0x00],
    POWER_ON_ICC: [0x62, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    POWER_OFF_ICC: [0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    GET_SLOT_STATUS: [0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    XFR_BLOCK: [0x6F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  }
};

// Helper pour identifier le bR301-BLE
export function isBR301Device(deviceName: string): boolean {
  if (!deviceName) return false;
  
  const name = deviceName.toLowerCase();
  return (
    name.includes('br301') ||
    name.includes('br-301') ||
    (name.includes('feitian') && name.includes('br')) ||
    name.includes('ft br301')
  );
}

// Helper pour vérifier si c'est un device USB Feitian
export function isBR301USB(vendorId: number, productId: number): boolean {
  return vendorId === BR301_CONFIG.VENDOR_ID_USB;
}

export default BR301_CONFIG;
