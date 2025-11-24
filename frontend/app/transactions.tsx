import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import { getTransactions } from '../services/api';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  created_at: string;
  block_number?: number;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending' | 'failed'>('all');

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await getTransactions(params);
      setTransactions(response.transactions || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return COLORS.success;
      case 'failed': return COLORS.danger;
      case 'processing': return COLORS.warning;
      default: return COLORS.gray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'processing': return 'hourglass';
      default: return 'time';
    }
  };

  const renderTransaction = (tx: Transaction) => (
    <View key={tx.id} style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tx.status) }]}>
          <Ionicons name={getStatusIcon(tx.status) as any} size={16} color={COLORS.white} />
          <Text style={styles.statusText}>{tx.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.transactionDate}>
          {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
        </Text>
      </View>

      <View style={styles.transactionBody}>
        <View style={styles.amountContainer}>
          <Text style={styles.transactionAmount}>{tx.amount}</Text>
          <Text style={styles.transactionCurrency}>
            {CURRENCY_NAMES[tx.currency as keyof typeof CURRENCY_NAMES] || tx.currency}
          </Text>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="wallet-outline" size={16} color={COLORS.gray} />
            <Text style={styles.detailText}>
              De: {tx.from_address.slice(0, 10)}...{tx.from_address.slice(-6)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="arrow-forward-outline" size={16} color={COLORS.gray} />
            <Text style={styles.detailText}>
              Vers: {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-6)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="link-outline" size={16} color={COLORS.gray} />
            <Text style={styles.detailText}>
              TX: {tx.tx_hash.slice(0, 10)}...{tx.tx_hash.slice(-6)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.transactionFooter}>
        <View style={styles.paymentTypeBadge}>
          <Text style={styles.paymentTypeText}>
            {tx.payment_type === 'crypto_link' ? 'Crypto Link' : 'Carte'}
          </Text>
        </View>
        {tx.block_number && (
          <Text style={styles.blockNumber}>Bloc #{tx.block_number}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'confirmed', 'pending', 'failed'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                filter === status && styles.filterTabActive
              ]}
              onPress={() => setFilter(status as any)}
            >
              <Text style={[
                styles.filterTabText,
                filter === status && styles.filterTabTextActive
              ]}>
                {status === 'all' ? 'Toutes' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={COLORS.gray} />
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : (
            transactions.map(renderTransaction)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white
  },
  filterContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.light
  },
  filterTabActive: {
    backgroundColor: COLORS.primary
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray
  },
  filterTabTextActive: {
    color: COLORS.white
  },
  content: {
    flex: 1,
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16
  },
  transactionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4
  },
  transactionDate: {
    fontSize: 12,
    color: COLORS.gray
  },
  transactionBody: {
    marginBottom: 12
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12
  },
  transactionAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 8
  },
  transactionCurrency: {
    fontSize: 16,
    color: COLORS.gray
  },
  transactionDetails: {
    gap: 8
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  detailText: {
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: 'monospace'
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  paymentTypeBadge: {
    backgroundColor: COLORS.light,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8
  },
  paymentTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark
  },
  blockNumber: {
    fontSize: 12,
    color: COLORS.gray
  }
});
