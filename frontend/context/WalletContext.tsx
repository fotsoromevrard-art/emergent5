import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletBalance, getMerchantWallet } from '../services/api';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted: string;
  contract_address: string;
}

interface WalletContextType {
  merchantAddress: string | null;
  setMerchantAddress: (address: string) => Promise<void>;
  balances: TokenBalance[];
  bnbBalance: string;
  loading: boolean;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [merchantAddress, setMerchantAddressState] = useState<string | null>(null);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [bnbBalance, setBnbBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const stored = await AsyncStorage.getItem('merchantAddress');
      if (stored) {
        setMerchantAddressState(stored);
        await fetchBalances(stored);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading wallet:', error);
      setLoading(false);
    }
  };

  const setMerchantAddress = async (address: string) => {
    try {
      await AsyncStorage.setItem('merchantAddress', address);
      setMerchantAddressState(address);
      await fetchBalances(address);
    } catch (error) {
      console.error('Error setting merchant address:', error);
      throw error;
    }
  };

  const fetchBalances = async (address: string) => {
    try {
      const data = await getWalletBalance(address);
      setBalances(data.tokens || []);
      setBnbBalance(data.bnb_balance || '0');
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const refreshBalances = async () => {
    if (merchantAddress) {
      await fetchBalances(merchantAddress);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        merchantAddress,
        setMerchantAddress,
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
