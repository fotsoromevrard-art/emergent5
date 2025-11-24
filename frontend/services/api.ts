import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Blockchain Status
export const getBlockchainStatus = async () => {
  const response = await api.get('/blockchain/status');
  return response.data;
};

// Wallet Configuration
export const configureMerchantWallet = async (address: string) => {
  const response = await api.post('/wallet/configure', {
    merchant_address: address
  });
  return response.data;
};

export const getMerchantWallet = async () => {
  const response = await api.get('/wallet/merchant');
  return response.data;
};

// Balance
export const getWalletBalance = async (walletAddress: string) => {
  const response = await api.post('/balance', {
    wallet_address: walletAddress
  });
  return response.data;
};

// Payment Links
export const createPaymentLink = async (data: {
  amount: number;
  currency: string;
  recipient_address: string;
  description?: string;
}) => {
  const response = await api.post('/payment/create-link', data);
  return response.data;
};

export const getPaymentDetails = async (paymentId: string) => {
  const response = await api.get(`/payment/${paymentId}`);
  return response.data;
};

// Transactions
export const createTransaction = async (data: {
  payment_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  currency: string;
  payment_type: string;
}) => {
  const response = await api.post('/transaction/create', data);
  return response.data;
};

export const getTransactionStatus = async (txHash: string) => {
  const response = await api.get(`/transaction/${txHash}`);
  return response.data;
};

export const getTransactions = async (params?: {
  limit?: number;
  status?: string;
  currency?: string;
}) => {
  const response = await api.get('/transactions', { params });
  return response.data;
};

// Refunds
export const processRefund = async (data: {
  transaction_id: string;
  amount?: number;
  reason: string;
}) => {
  const response = await api.post('/refund/process', data);
  return response.data;
};

// Supported Tokens
export const getSupportedTokens = async () => {
  const response = await api.get('/tokens/supported');
  return response.data;
};

export default api;
