import Constants from 'expo-constants';

// Backend API URL
export const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// BSC Configuration
export const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
export const BSC_CHAIN_ID = 97;

// Token Addresses on BSC Testnet
export const TOKEN_ADDRESSES = {
  XAF_STABLE: '0x3c96aBa8bA994Cb2452a9BcE362Efb0EDCDfaEee',
  EUROM_STABLE: '0x531B876fc439F64Be5922551FE222aBf08B8D08E',
  TND_STABLE: '0x6ae8193d14fb289E43AD1238aadEB1E537EdCa6B'
};

// Currency Display Names
export const CURRENCY_NAMES = {
  XAF_STABLE: 'XAF Stable',
  EUROM_STABLE: 'EUROM Stable',
  TND_STABLE: 'TND Stable'
};

// Payment Types
export const PAYMENT_TYPES = {
  CARD_CONTACT: 'card_contact',
  CARD_USB: 'card_usb',
  CARD_BLUETOOTH: 'card_bluetooth',
  CRYPTO_LINK: 'crypto_link'
};

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Colors
export const COLORS = {
  primary: '#1E3A8A',
  secondary: '#3B82F6',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  dark: '#1F2937',
  light: '#F3F4F6',
  white: '#FFFFFF',
  gray: '#6B7280',
  border: '#E5E7EB'
};
