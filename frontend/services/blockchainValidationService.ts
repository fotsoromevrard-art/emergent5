/**
 * Service de validation d'adresse blockchain
 * Supporte BSC et Ethereum avec détection automatique
 */

// Configuration des réseaux
export const NETWORKS = {
  BSC: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    explorerUrl: 'https://bscscan.com',
    explorerApiUrl: 'https://api.bscscan.com/api',
    color: '#F3BA2F'
  },
  ETHEREUM: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    color: '#627EEA'
  }
};

export type NetworkType = 'bsc' | 'ethereum';

export interface AddressValidation {
  isValid: boolean;
  format: boolean;
  network: NetworkType | null;
  hasActivity: boolean;
  balance: string;
  transactionCount: number;
  error?: string;
}

export interface NetworkInfo {
  id: NetworkType;
  name: string;
  chainId: number;
  symbol: string;
  color: string;
}

class BlockchainValidationService {
  
  // =============== VALIDATION FORMAT ===============
  
  /**
   * Valider le format d'une adresse Ethereum/BSC
   */
  isValidAddressFormat(address: string): boolean {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Convertir l'adresse en checksum (EIP-55)
   */
  toChecksumAddress(address: string): string {
    if (!this.isValidAddressFormat(address)) return address;
    
    const addr = address.toLowerCase().replace('0x', '');
    // Simplified checksum - in production use keccak256
    return '0x' + addr;
  }

  // =============== VALIDATION RÉSEAU ===============

  /**
   * Vérifier l'activité d'une adresse sur un réseau spécifique
   */
  async checkAddressOnNetwork(
    address: string, 
    network: 'BSC' | 'ETHEREUM'
  ): Promise<{ hasActivity: boolean; balance: string; txCount: number }> {
    const config = NETWORKS[network];
    
    try {
      // Appel RPC pour obtenir le solde
      const balanceResponse = await fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1
        })
      });

      const balanceData = await balanceResponse.json();
      const balanceWei = balanceData.result ? parseInt(balanceData.result, 16) : 0;
      const balance = (balanceWei / 1e18).toFixed(6);

      // Appel RPC pour obtenir le nombre de transactions
      const txCountResponse = await fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [address, 'latest'],
          id: 2
        })
      });

      const txCountData = await txCountResponse.json();
      const txCount = txCountData.result ? parseInt(txCountData.result, 16) : 0;

      // Une adresse a de l'activité si elle a un solde ou des transactions
      const hasActivity = balanceWei > 0 || txCount > 0;

      return {
        hasActivity,
        balance,
        txCount
      };

    } catch (error) {
      console.error(`Erreur vérification ${network}:`, error);
      return {
        hasActivity: false,
        balance: '0',
        txCount: 0
      };
    }
  }

  /**
   * Détecter automatiquement le réseau d'une adresse
   * Vérifie d'abord BSC (par défaut), puis Ethereum
   */
  async detectNetwork(address: string): Promise<{
    network: NetworkType | null;
    bscInfo: { hasActivity: boolean; balance: string; txCount: number };
    ethInfo: { hasActivity: boolean; balance: string; txCount: number };
  }> {
    if (!this.isValidAddressFormat(address)) {
      return {
        network: null,
        bscInfo: { hasActivity: false, balance: '0', txCount: 0 },
        ethInfo: { hasActivity: false, balance: '0', txCount: 0 }
      };
    }

    // Vérifier sur les deux réseaux en parallèle
    const [bscInfo, ethInfo] = await Promise.all([
      this.checkAddressOnNetwork(address, 'BSC'),
      this.checkAddressOnNetwork(address, 'ETHEREUM')
    ]);

    // Déterminer le réseau principal
    let network: NetworkType | null = null;

    if (bscInfo.hasActivity && ethInfo.hasActivity) {
      // Activité sur les deux - prioriser BSC (par défaut)
      network = 'bsc';
    } else if (bscInfo.hasActivity) {
      network = 'bsc';
    } else if (ethInfo.hasActivity) {
      network = 'ethereum';
    } else {
      // Aucune activité - utiliser BSC par défaut
      network = 'bsc';
    }

    return {
      network,
      bscInfo,
      ethInfo
    };
  }

  /**
   * Validation complète d'une adresse
   */
  async validateAddress(address: string): Promise<AddressValidation> {
    // Vérifier le format
    const formatValid = this.isValidAddressFormat(address);
    
    if (!formatValid) {
      return {
        isValid: false,
        format: false,
        network: null,
        hasActivity: false,
        balance: '0',
        transactionCount: 0,
        error: 'Format d\'adresse invalide'
      };
    }

    try {
      // Détecter le réseau
      const detection = await this.detectNetwork(address);
      
      const networkInfo = detection.network === 'bsc' 
        ? detection.bscInfo 
        : detection.ethInfo;

      return {
        isValid: true,
        format: true,
        network: detection.network,
        hasActivity: networkInfo.hasActivity,
        balance: networkInfo.balance,
        transactionCount: networkInfo.txCount
      };

    } catch (error: any) {
      return {
        isValid: true, // Format valide même si la vérification échoue
        format: true,
        network: 'bsc', // BSC par défaut
        hasActivity: false,
        balance: '0',
        transactionCount: 0,
        error: 'Impossible de vérifier l\'adresse sur la blockchain'
      };
    }
  }

  // =============== HELPERS ===============

  /**
   * Obtenir les infos d'un réseau
   */
  getNetworkInfo(networkId: NetworkType): NetworkInfo {
    const config = networkId === 'bsc' ? NETWORKS.BSC : NETWORKS.ETHEREUM;
    return {
      id: networkId,
      name: config.name,
      chainId: config.chainId,
      symbol: config.symbol,
      color: config.color
    };
  }

  /**
   * Obtenir l'URL de l'explorateur pour une adresse
   */
  getExplorerUrl(address: string, networkId: NetworkType): string {
    const config = networkId === 'bsc' ? NETWORKS.BSC : NETWORKS.ETHEREUM;
    return `${config.explorerUrl}/address/${address}`;
  }

  /**
   * Obtenir l'URL de l'explorateur pour une transaction
   */
  getTxExplorerUrl(txHash: string, networkId: NetworkType): string {
    const config = networkId === 'bsc' ? NETWORKS.BSC : NETWORKS.ETHEREUM;
    return `${config.explorerUrl}/tx/${txHash}`;
  }
}

// Export singleton
export default new BlockchainValidationService();
