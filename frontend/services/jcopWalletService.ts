/**
 * Service APDU pour cartes JCOP ISO-7816 (Infineon SLE78)
 * 
 * Ce service gère les commandes APDU pour :
 * - Sélection d'applet wallet
 * - Lecture d'adresse et solde
 * - Signature de transactions
 * - Débit de la carte
 * 
 * Compatible avec :
 * - Protocoles T=0 et T=1
 * - Cartes Class A, B, C
 * - Infineon SLE78CLFX4000PM
 * - FTJCOS (FIPS 140-2 Level 3)
 */

import br301BleService, { APDUResponse } from './br301BleService';
import br301UsbService from './br301UsbService';

// =============== CONSTANTES APDU ISO-7816 ===============

// Classes d'instruction
const CLA = {
  ISO: 0x00,        // Standard ISO 7816
  PROPRIETARY: 0x80, // Commandes propriétaires
  SECURE: 0x84,     // Secure messaging
};

// Instructions standard ISO 7816-4
const INS = {
  SELECT: 0xA4,           // Sélectionner fichier/applet
  READ_BINARY: 0xB0,      // Lire données binaires
  READ_RECORD: 0xB2,      // Lire enregistrement
  GET_DATA: 0xCA,         // Obtenir données (TLV)
  PUT_DATA: 0xDA,         // Écrire données
  VERIFY: 0x20,           // Vérifier PIN
  CHANGE_PIN: 0x24,       // Changer PIN
  INTERNAL_AUTH: 0x88,    // Authentification interne
  EXTERNAL_AUTH: 0x82,    // Authentification externe
  GET_CHALLENGE: 0x84,    // Obtenir défi aléatoire
  GET_RESPONSE: 0xC0,     // Obtenir réponse (T=0)
};

// Instructions propriétaires pour wallet crypto
const INS_WALLET = {
  GET_ADDRESS: 0x50,      // Obtenir adresse du wallet
  GET_BALANCE: 0x52,      // Obtenir solde
  SIGN_TX: 0x54,          // Signer transaction
  DEBIT: 0x56,            // Débiter le wallet
  GET_PUBLIC_KEY: 0x58,   // Obtenir clé publique
};

// Status Words (SW1 SW2)
const SW = {
  SUCCESS: 0x9000,
  MORE_DATA: 0x61,        // SW1 = 0x61, SW2 = bytes restants
  WRONG_LENGTH: 0x6700,
  SECURITY_NOT_SATISFIED: 0x6982,
  AUTH_BLOCKED: 0x6983,
  DATA_INVALID: 0x6984,
  CONDITIONS_NOT_SATISFIED: 0x6985,
  WRONG_DATA: 0x6A80,
  FILE_NOT_FOUND: 0x6A82,
  RECORD_NOT_FOUND: 0x6A83,
  NOT_ENOUGH_SPACE: 0x6A84,
  WRONG_P1P2: 0x6A86,
  INS_NOT_SUPPORTED: 0x6D00,
  CLA_NOT_SUPPORTED: 0x6E00,
};

// AID de l'applet wallet (à personnaliser selon votre applet)
// Format: RID (5 bytes) + PIX (variable)
const WALLET_APPLET_AID = new Uint8Array([
  0xA0, 0x00, 0x00, 0x00, 0x62, // RID (exemple)
  0x03, 0x01, 0x0C, 0x06, 0x01  // PIX pour wallet
]);

// Types
export interface WalletData {
  address: string;
  balance: number;
  currency: string;
  publicKey?: string;
}

export interface TransactionData {
  to: string;           // Adresse destinataire (marchand)
  amount: number;       // Montant
  currency: string;     // Devise (XAF, EUROM, TND)
  chainId: number;      // Chain ID BSC (56 ou 97 testnet)
  nonce?: number;       // Nonce de transaction
}

export interface SignedTransaction {
  txHash: string;
  signature: string;
  v: number;
  r: string;
  s: string;
}

// =============== CLASSE PRINCIPALE ===============

class JCOPWalletService {
  private connectionType: 'bluetooth' | 'usb' | null = null;
  private isCardSelected: boolean = false;

  // =============== HELPERS APDU ===============

  /**
   * Construire une commande APDU
   */
  private buildAPDU(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data?: Uint8Array,
    le?: number
  ): Uint8Array {
    const hasData = data && data.length > 0;
    const hasLe = le !== undefined;

    let length = 4; // CLA + INS + P1 + P2
    if (hasData) length += 1 + data.length; // Lc + Data
    if (hasLe) length += 1; // Le

    const apdu = new Uint8Array(length);
    let offset = 0;

    apdu[offset++] = cla;
    apdu[offset++] = ins;
    apdu[offset++] = p1;
    apdu[offset++] = p2;

    if (hasData) {
      apdu[offset++] = data.length; // Lc
      apdu.set(data, offset);
      offset += data.length;
    }

    if (hasLe) {
      apdu[offset] = le;
    }

    return apdu;
  }

  /**
   * Envoyer une commande APDU via le lecteur connecté
   */
  private async sendAPDU(apdu: Uint8Array): Promise<APDUResponse> {
    if (this.connectionType === 'bluetooth') {
      return await br301BleService.sendAPDU(apdu);
    } else if (this.connectionType === 'usb') {
      // Convertir la réponse USB au format APDUResponse
      const response = await br301UsbService.sendCommand(apdu);
      const len = response.length;
      return {
        data: response.slice(0, len - 2),
        sw1: response[len - 2] || 0,
        sw2: response[len - 1] || 0,
        success: response[len - 2] === 0x90 && response[len - 1] === 0x00
      };
    } else {
      throw new Error('Aucun lecteur connecté');
    }
  }

  /**
   * Vérifier le status word
   */
  private checkSW(response: APDUResponse, context: string): void {
    const sw = (response.sw1 << 8) | response.sw2;
    
    if (sw === SW.SUCCESS) return;
    
    // Gérer les cas d'erreur
    switch (sw) {
      case SW.SECURITY_NOT_SATISFIED:
        throw new Error(`${context}: Sécurité non satisfaite (PIN requis)`);
      case SW.AUTH_BLOCKED:
        throw new Error(`${context}: Carte bloquée`);
      case SW.FILE_NOT_FOUND:
        throw new Error(`${context}: Applet non trouvé`);
      case SW.CONDITIONS_NOT_SATISFIED:
        throw new Error(`${context}: Conditions non remplies`);
      case SW.WRONG_DATA:
        throw new Error(`${context}: Données invalides`);
      default:
        throw new Error(`${context}: Erreur SW=${sw.toString(16).toUpperCase()}`);
    }
  }

  /**
   * Convertir bytes en hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convertir hex string en bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // =============== CONNEXION ===============

  /**
   * Définir le type de connexion actif
   */
  setConnectionType(type: 'bluetooth' | 'usb') {
    this.connectionType = type;
    this.isCardSelected = false;
  }

  // =============== SÉLECTION D'APPLET ===============

  /**
   * Sélectionner l'applet wallet sur la carte
   */
  async selectWalletApplet(): Promise<boolean> {
    console.log('📱 Sélection de l\'applet wallet...');

    const apdu = this.buildAPDU(
      CLA.ISO,
      INS.SELECT,
      0x04,  // P1: Sélection par AID
      0x00,  // P2: Premier ou seul
      WALLET_APPLET_AID,
      0x00   // Le: Attendre réponse
    );

    try {
      const response = await this.sendAPDU(apdu);
      this.checkSW(response, 'SELECT');
      this.isCardSelected = true;
      console.log('✅ Applet wallet sélectionné');
      return true;
    } catch (error) {
      console.error('❌ Erreur sélection applet:', error);
      this.isCardSelected = false;
      return false;
    }
  }

  // =============== LECTURE DONNÉES ===============

  /**
   * Lire l'adresse du wallet depuis la carte
   */
  async getWalletAddress(): Promise<string> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    console.log('🔍 Lecture de l\'adresse wallet...');

    const apdu = this.buildAPDU(
      CLA.PROPRIETARY,
      INS_WALLET.GET_ADDRESS,
      0x00,
      0x00,
      undefined,
      0x14  // 20 bytes pour adresse Ethereum
    );

    const response = await this.sendAPDU(apdu);
    this.checkSW(response, 'GET_ADDRESS');

    const address = '0x' + this.bytesToHex(response.data);
    console.log('✅ Adresse:', address);
    return address;
  }

  /**
   * Lire le solde du wallet depuis la carte
   */
  async getWalletBalance(currency: string): Promise<number> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    console.log('🔍 Lecture du solde...');

    // Encoder la devise dans P1
    const currencyCode = this.getCurrencyCode(currency);

    const apdu = this.buildAPDU(
      CLA.PROPRIETARY,
      INS_WALLET.GET_BALANCE,
      currencyCode,
      0x00,
      undefined,
      0x08  // 8 bytes pour le solde (uint64)
    );

    const response = await this.sendAPDU(apdu);
    this.checkSW(response, 'GET_BALANCE');

    // Convertir bytes en nombre (big-endian)
    let balance = 0;
    for (let i = 0; i < response.data.length; i++) {
      balance = balance * 256 + response.data[i];
    }
    
    // Diviser par 10^18 (wei -> token)
    const balanceFormatted = balance / 1e18;
    console.log('✅ Solde:', balanceFormatted, currency);
    return balanceFormatted;
  }

  /**
   * Obtenir la clé publique
   */
  async getPublicKey(): Promise<string> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    const apdu = this.buildAPDU(
      CLA.PROPRIETARY,
      INS_WALLET.GET_PUBLIC_KEY,
      0x00,
      0x00,
      undefined,
      0x41  // 65 bytes (uncompressed public key)
    );

    const response = await this.sendAPDU(apdu);
    this.checkSW(response, 'GET_PUBLIC_KEY');

    return '0x' + this.bytesToHex(response.data);
  }

  // =============== VÉRIFICATION PIN ===============

  /**
   * Vérifier le PIN de la carte
   */
  async verifyPIN(pin: string): Promise<boolean> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    console.log('🔐 Vérification du PIN...');

    // Encoder le PIN (format numérique ASCII)
    const pinBytes = new Uint8Array(pin.length);
    for (let i = 0; i < pin.length; i++) {
      pinBytes[i] = pin.charCodeAt(i);
    }

    const apdu = this.buildAPDU(
      CLA.ISO,
      INS.VERIFY,
      0x00,
      0x00,  // P2: PIN reference
      pinBytes
    );

    try {
      const response = await this.sendAPDU(apdu);
      this.checkSW(response, 'VERIFY_PIN');
      console.log('✅ PIN vérifié');
      return true;
    } catch (error: any) {
      console.error('❌ PIN incorrect:', error.message);
      return false;
    }
  }

  // =============== SIGNATURE DE TRANSACTION ===============

  /**
   * Signer une transaction avec la carte
   */
  async signTransaction(tx: TransactionData): Promise<SignedTransaction> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    console.log('✍️ Signature de la transaction...');

    // Encoder les données de transaction
    const txData = this.encodeTransaction(tx);

    const apdu = this.buildAPDU(
      CLA.PROPRIETARY,
      INS_WALLET.SIGN_TX,
      0x00,
      0x00,
      txData,
      0x41  // 65 bytes (signature: r[32] + s[32] + v[1])
    );

    const response = await this.sendAPDU(apdu);
    this.checkSW(response, 'SIGN_TX');

    // Parser la signature
    const signature = response.data;
    const r = this.bytesToHex(signature.slice(0, 32));
    const s = this.bytesToHex(signature.slice(32, 64));
    const v = signature[64];

    // Calculer le hash de transaction
    const txHash = this.calculateTxHash(txData);

    console.log('✅ Transaction signée');

    return {
      txHash: txHash,
      signature: '0x' + this.bytesToHex(signature),
      v: v,
      r: '0x' + r,
      s: '0x' + s
    };
  }

  /**
   * Débiter le wallet de la carte
   */
  async debitWallet(tx: TransactionData): Promise<boolean> {
    if (!this.isCardSelected) {
      await this.selectWalletApplet();
    }

    console.log('💳 Débit du wallet...');

    // Encoder les données de débit
    const debitData = this.encodeDebitData(tx);

    const apdu = this.buildAPDU(
      CLA.PROPRIETARY,
      INS_WALLET.DEBIT,
      0x00,
      0x00,
      debitData
    );

    const response = await this.sendAPDU(apdu);
    this.checkSW(response, 'DEBIT');

    console.log('✅ Débit effectué');
    return true;
  }

  // =============== HELPERS PRIVÉS ===============

  /**
   * Obtenir le code de devise
   */
  private getCurrencyCode(currency: string): number {
    const codes: { [key: string]: number } = {
      'XAF_STABLE': 0x01,
      'EUROM_STABLE': 0x02,
      'TND_STABLE': 0x03,
    };
    return codes[currency] || 0x00;
  }

  /**
   * Encoder une transaction pour signature
   */
  private encodeTransaction(tx: TransactionData): Uint8Array {
    // Format simplifié pour l'exemple
    // En production, utiliser RLP encoding pour EIP-155
    const toAddress = this.hexToBytes(tx.to);
    const amountWei = BigInt(Math.floor(tx.amount * 1e18));
    const amountBytes = new Uint8Array(32);
    
    // Encoder le montant en big-endian
    let temp = amountWei;
    for (let i = 31; i >= 0; i--) {
      amountBytes[i] = Number(temp & BigInt(0xFF));
      temp = temp >> BigInt(8);
    }

    const currencyCode = this.getCurrencyCode(tx.currency);
    const chainIdBytes = new Uint8Array([tx.chainId]);

    // Combiner: [to(20)] + [amount(32)] + [currency(1)] + [chainId(1)]
    const data = new Uint8Array(54);
    data.set(toAddress, 0);
    data.set(amountBytes, 20);
    data[52] = currencyCode;
    data[53] = tx.chainId;

    return data;
  }

  /**
   * Encoder les données de débit
   */
  private encodeDebitData(tx: TransactionData): Uint8Array {
    const toAddress = this.hexToBytes(tx.to);
    const amountWei = BigInt(Math.floor(tx.amount * 1e18));
    const amountBytes = new Uint8Array(8);
    
    let temp = amountWei;
    for (let i = 7; i >= 0; i--) {
      amountBytes[i] = Number(temp & BigInt(0xFF));
      temp = temp >> BigInt(8);
    }

    const currencyCode = this.getCurrencyCode(tx.currency);

    // [to(20)] + [amount(8)] + [currency(1)]
    const data = new Uint8Array(29);
    data.set(toAddress, 0);
    data.set(amountBytes, 20);
    data[28] = currencyCode;

    return data;
  }

  /**
   * Calculer le hash de transaction (simplifié)
   */
  private calculateTxHash(txData: Uint8Array): string {
    // En production, utiliser keccak256
    // Pour l'instant, hash simple pour démonstration
    let hash = 0;
    for (let i = 0; i < txData.length; i++) {
      hash = ((hash << 5) - hash) + txData[i];
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
  }

  // =============== FLUX COMPLET DE PAIEMENT ===============

  /**
   * Processus complet de paiement par carte
   */
  async processPayment(
    merchantAddress: string,
    amount: number,
    currency: string,
    pin?: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    cardAddress?: string;
    newBalance?: number;
    error?: string;
  }> {
    try {
      console.log('🚀 Démarrage du paiement...');
      console.log(`   Montant: ${amount} ${currency}`);
      console.log(`   Destinataire: ${merchantAddress}`);

      // 1. Sélectionner l'applet
      const selected = await this.selectWalletApplet();
      if (!selected) {
        throw new Error('Impossible de sélectionner l\'applet wallet');
      }

      // 2. Vérifier le PIN si fourni
      if (pin) {
        const pinOk = await this.verifyPIN(pin);
        if (!pinOk) {
          throw new Error('PIN incorrect');
        }
      }

      // 3. Lire l'adresse de la carte
      const cardAddress = await this.getWalletAddress();

      // 4. Lire le solde
      const balance = await this.getWalletBalance(currency);
      if (balance < amount) {
        throw new Error(`Solde insuffisant (${balance} < ${amount})`);
      }

      // 5. Préparer la transaction
      const tx: TransactionData = {
        to: merchantAddress,
        amount: amount,
        currency: currency,
        chainId: 56, // BSC Mainnet (ou 97 pour testnet)
      };

      // 6. Signer la transaction
      const signedTx = await this.signTransaction(tx);

      // 7. Débiter la carte
      await this.debitWallet(tx);

      // 8. Lire le nouveau solde
      const newBalance = await this.getWalletBalance(currency);

      console.log('✅ Paiement réussi !');
      console.log(`   TX Hash: ${signedTx.txHash}`);
      console.log(`   Nouveau solde: ${newBalance}`);

      return {
        success: true,
        txHash: signedTx.txHash,
        cardAddress: cardAddress,
        newBalance: newBalance
      };

    } catch (error: any) {
      console.error('❌ Erreur paiement:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =============== RESET ===============

  reset() {
    this.isCardSelected = false;
  }
}

// Export singleton
export default new JCOPWalletService();
