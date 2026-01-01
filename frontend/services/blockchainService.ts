/**
 * Service Blockchain Autonome
 * 
 * Ce service effectue toutes les opérations blockchain DIRECTEMENT
 * depuis l'application mobile, sans dépendre d'un backend externe.
 * 
 * Fonctionnalités :
 * - Lecture des soldes de tokens ERC20
 * - Validation d'adresses
 * - Vérification de transactions
 * - Connexion BSC Mainnet et Testnet
 */

import { ethers } from 'ethers';

// =============== CONFIGURATION ===============

// RPC URLs (publics et gratuits)
export const RPC_URLS = {
  BSC_MAINNET: 'https://bsc-dataseed.binance.org/',
  BSC_MAINNET_BACKUP: 'https://bsc-dataseed1.binance.org/',
  BSC_TESTNET: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  ETHEREUM_MAINNET: 'https://eth.llamarpc.com',
  ETHEREUM_MAINNET_BACKUP: 'https://rpc.ankr.com/eth'
};

// Chain IDs
export const CHAIN_IDS = {
  BSC_MAINNET: 56,
  BSC_TESTNET: 97,
  ETHEREUM_MAINNET: 1
};

// Tokens sur BSC (vos stablecoins personnalisés)
export const TOKENS = {
  XAF_STABLE: {
    address: '0x3c96aBa8bA994Cb2452a9BcE362Efb0EDCDfaEee',
    symbol: 'XAF',
    name: 'XAF Stable',
    decimals: 18
  },
  EUROM_STABLE: {
    address: '0x531B876fc439F64Be5922551FE222aBf08B8D08E',
    symbol: 'EUROM',
    name: 'EUROM Stable',
    decimals: 18
  },
  TND_STABLE: {
    address: '0x6ae8193d14fb289E43AD1238aadEB1E537EdCa6B',
    symbol: 'TND',
    name: 'TND Stable',
    decimals: 18
  }
};

// ABI minimal ERC20 (pour lecture des soldes)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// =============== TYPES ===============

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted: string;
  contract_address: string;
  decimals: number;
}

export interface WalletInfo {
  address: string;
  bnb_balance: string;
  tokens: TokenBalance[];
  network: 'bsc' | 'ethereum';
}

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp?: number;
}

// =============== CLASSE PRINCIPALE ===============

class BlockchainService {
  private bscProvider: ethers.JsonRpcProvider | null = null;
  private ethProvider: ethers.JsonRpcProvider | null = null;
  private currentNetwork: 'bsc' | 'ethereum' = 'bsc';

  constructor() {
    this.initProviders();
  }

  // =============== INITIALISATION ===============

  private async initProviders() {
    try {
      // Provider BSC
      this.bscProvider = new ethers.JsonRpcProvider(RPC_URLS.BSC_MAINNET);
      
      // Provider Ethereum
      this.ethProvider = new ethers.JsonRpcProvider(RPC_URLS.ETHEREUM_MAINNET);
      
      console.log('✅ Providers blockchain initialisés');
    } catch (error) {
      console.error('❌ Erreur initialisation providers:', error);
    }
  }

  private getProvider(network: 'bsc' | 'ethereum' = 'bsc'): ethers.JsonRpcProvider {
    if (network === 'ethereum' && this.ethProvider) {
      return this.ethProvider;
    }
    if (!this.bscProvider) {
      this.bscProvider = new ethers.JsonRpcProvider(RPC_URLS.BSC_MAINNET);
    }
    return this.bscProvider;
  }

  // =============== VALIDATION ===============

  /**
   * Valider le format d'une adresse
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Convertir en adresse checksum
   */
  toChecksumAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      return address;
    }
  }

  // =============== SOLDES ===============

  /**
   * Obtenir le solde BNB/ETH d'une adresse
   */
  async getNativeBalance(address: string, network: 'bsc' | 'ethereum' = 'bsc'): Promise<string> {
    try {
      const provider = this.getProvider(network);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Erreur lecture solde natif:', error);
      return '0';
    }
  }

  /**
   * Obtenir le solde d'un token ERC20
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    network: 'bsc' | 'ethereum' = 'bsc'
  ): Promise<{ balance: string; decimals: number }> {
    try {
      const provider = this.getProvider(network);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals()
      ]);
      
      return {
        balance: ethers.formatUnits(balance, decimals),
        decimals: Number(decimals)
      };
    } catch (error) {
      console.error('Erreur lecture solde token:', error);
      return { balance: '0', decimals: 18 };
    }
  }

  /**
   * Obtenir tous les soldes (BNB + tokens) d'un wallet
   */
  async getWalletInfo(address: string, network: 'bsc' | 'ethereum' = 'bsc'): Promise<WalletInfo> {
    try {
      // Solde natif (BNB ou ETH)
      const bnbBalance = await this.getNativeBalance(address, network);
      
      // Soldes des tokens (uniquement sur BSC pour nos stablecoins)
      const tokens: TokenBalance[] = [];
      
      if (network === 'bsc') {
        for (const [key, token] of Object.entries(TOKENS)) {
          try {
            const { balance, decimals } = await this.getTokenBalance(
              address,
              token.address,
              network
            );
            
            tokens.push({
              symbol: token.symbol,
              name: token.name,
              balance: balance,
              balance_formatted: parseFloat(balance).toFixed(4),
              contract_address: token.address,
              decimals: decimals
            });
          } catch (err) {
            console.log(`Token ${token.symbol} non disponible`);
          }
        }
      }
      
      return {
        address,
        bnb_balance: bnbBalance,
        tokens,
        network
      };
    } catch (error) {
      console.error('Erreur lecture wallet info:', error);
      return {
        address,
        bnb_balance: '0',
        tokens: [],
        network
      };
    }
  }

  // =============== TRANSACTIONS ===============

  /**
   * Obtenir les infos d'une transaction
   */
  async getTransactionInfo(txHash: string, network: 'bsc' | 'ethereum' = 'bsc'): Promise<TransactionInfo | null> {
    try {
      const provider = this.getProvider(network);
      const tx = await provider.getTransaction(txHash);
      
      if (!tx) return null;
      
      const receipt = await provider.getTransactionReceipt(txHash);
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
        blockNumber: receipt?.blockNumber,
        timestamp: undefined // Nécessiterait un appel supplémentaire
      };
    } catch (error) {
      console.error('Erreur lecture transaction:', error);
      return null;
    }
  }

  /**
   * Attendre la confirmation d'une transaction
   */
  async waitForTransaction(txHash: string, network: 'bsc' | 'ethereum' = 'bsc'): Promise<boolean> {
    try {
      const provider = this.getProvider(network);
      const receipt = await provider.waitForTransaction(txHash, 1, 60000);
      return receipt?.status === 1;
    } catch (error) {
      console.error('Erreur attente transaction:', error);
      return false;
    }
  }

  // =============== VÉRIFICATION RÉSEAU ===============

  /**
   * Vérifier la connexion au réseau
   */
  async checkNetworkConnection(network: 'bsc' | 'ethereum' = 'bsc'): Promise<boolean> {
    try {
      const provider = this.getProvider(network);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connecté au réseau ${network}, bloc #${blockNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur connexion ${network}:`, error);
      return false;
    }
  }

  /**
   * Obtenir le numéro de bloc actuel
   */
  async getBlockNumber(network: 'bsc' | 'ethereum' = 'bsc'): Promise<number> {
    try {
      const provider = this.getProvider(network);
      return await provider.getBlockNumber();
    } catch (error) {
      return 0;
    }
  }

  // =============== TOKENS SUPPORTÉS ===============

  /**
   * Obtenir la liste des tokens supportés
   */
  getSupportedTokens() {
    return Object.entries(TOKENS).map(([key, token]) => ({
      id: key,
      ...token
    }));
  }

  /**
   * Obtenir les infos d'un token par son symbole
   */
  getTokenBySymbol(symbol: string) {
    const entry = Object.entries(TOKENS).find(([_, t]) => t.symbol === symbol);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }
}

// Export singleton
const blockchainService = new BlockchainService();
export default blockchainService;
