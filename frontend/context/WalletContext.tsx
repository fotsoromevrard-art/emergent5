import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkType } from '../services/blockchainValidationService';
import blockchainService, { TokenBalance, WalletInfo } from '../services/blockchainService';

interface WalletContextType {
  merchantAddress: string | null;
  selectedNetwork: NetworkType;
  setMerchantAddress: (address: string, network?: NetworkType) => Promise<void>;
  setSelectedNetwork: (network: NetworkType) => Promise<void>;
  balances: TokenBalance[];
  bnbBalance: string;
  loading: boolean;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [merchantAddress, setMerchantAddressState] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetworkState] = useState<NetworkType>('bsc');
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [bnbBalance, setBnbBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const stored = await AsyncStorage.getItem('merchantAddress');
      const storedNetwork = await AsyncStorage.getItem('selectedNetwork') as NetworkType;
      
      if (storedNetwork) {
        setSelectedNetworkState(storedNetwork);
      }
      
      if (stored) {
        setMerchantAddressState(stored);
        await fetchBalances(stored, storedNetwork || 'bsc');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading wallet:', error);
      setLoading(false);
    }
  };

  const setMerchantAddress = async (address: string, network?: NetworkType) => {
    try {
      await AsyncStorage.setItem('merchantAddress', address);
      setMerchantAddressState(address);
      
      if (network) {
        await AsyncStorage.setItem('selectedNetwork', network);
        setSelectedNetworkState(network);
      }
      
      await fetchBalances(address, network || selectedNetwork);
    } catch (error) {
      console.error('Error setting merchant address:', error);
      throw error;
    }
  };

  const setSelectedNetwork = async (network: NetworkType) => {
    try {
      await AsyncStorage.setItem('selectedNetwork', network);
      setSelectedNetworkState(network);
      
      // Rafraîchir les soldes avec le nouveau réseau
      if (merchantAddress) {
        await fetchBalances(merchantAddress, network);
      }
    } catch (error) {
      console.error('Error setting network:', error);
      throw error;
    }
  };

  // Utilise le service blockchain autonome au lieu de l'API backend
  const fetchBalances = async (address: string, network: NetworkType = 'bsc') => {
    try {
      console.log('📊 Récupération des soldes via blockchain directe...');
      const walletInfo = await blockchainService.getWalletInfo(address, network);
      
      setBalances(walletInfo.tokens);
      setBnbBalance(walletInfo.bnb_balance);
      
      console.log('✅ Soldes récupérés:', walletInfo);
    } catch (error) {
      console.error('Error fetching balances:', error);
      // En cas d'erreur, mettre des valeurs par défaut
      setBalances([]);
      setBnbBalance('0');
    }
  };

  const refreshBalances = async () => {
    if (merchantAddress) {
      await fetchBalances(merchantAddress, selectedNetwork);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        merchantAddress,
        selectedNetwork,
        setMerchantAddress,
        setSelectedNetwork,
        balances,
        bnbBalance,
        loading,
        refreshBalances
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
