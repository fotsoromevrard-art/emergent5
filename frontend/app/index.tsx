import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWallet } from '../context/WalletContext';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import { configureMerchantWallet } from '../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { merchantAddress, setMerchantAddress, balances, bnbBalance, loading, refreshBalances } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletInput, setWalletInput] = useState('');

  useEffect(() => {
    if (!merchantAddress && !loading) {
      setShowWalletModal(true);
    }
  }, [merchantAddress, loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBalances();
    setRefreshing(false);
  };

  const handleSaveWallet = async () => {
    if (!walletInput || walletInput.length !== 42) {
      Alert.alert('Erreur', 'Adresse wallet invalide');
      return;
    }

    try {
      await configureMerchantWallet(walletInput);
      await setMerchantAddress(walletInput);
      setShowWalletModal(false);
      Alert.alert('Succès', 'Wallet marchand configuré');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de configurer le wallet');
    }
  };

  const getTotalBalance = () => {
    const total = balances.reduce((sum, token) => {
      return sum + parseFloat(token.balance_formatted || '0');
    }, 0);
    return total.toFixed(2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>TPE Crypto</Text>
            <Text style={styles.headerSubtitle}>Paiements Blockchain</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/parametres')}
          >
            <Ionicons name="settings-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Wallet Address */}
        {merchantAddress && (
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Marchand</Text>
            <Text style={styles.walletAddress}>
              {merchantAddress.slice(0, 10)}...{merchantAddress.slice(-8)}
            </Text>
          </View>
        )}

        {/* Balance Overview */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Solde Total Estimé</Text>
          <Text style={styles.balanceAmount}>{getTotalBalance()} Tokens</Text>
          <Text style={styles.balanceBNB}>BNB: {parseFloat(bnbBalance).toFixed(4)}</Text>
        </View>

        {/* Token Balances */}
        <View style={styles.tokensContainer}>
          <Text style={styles.sectionTitle}>Mes Devises</Text>
          {balances.map((token, index) => (
            <View key={index} style={styles.tokenCard}>
              <View style={styles.tokenIcon}>
                <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenName}>{token.name}</Text>
              </View>
              <View style={styles.tokenBalance}>
                <Text style={styles.tokenAmount}>
                  {parseFloat(token.balance_formatted).toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => router.push('/nouveau-paiement')}
          >
            <Ionicons name="add-circle-outline" size={28} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Nouveau Paiement</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => router.push('/transactions')}
            >
              <Ionicons name="list-outline" size={24} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Transactions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => router.push('/remboursements')}
            >
              <Ionicons name="arrow-undo-outline" size={24} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Remboursements</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.supportButton]}
            onPress={() => router.push('/support')}
          >
            <Ionicons name="help-circle-outline" size={24} color={COLORS.gray} />
            <Text style={styles.supportButtonText}>Support & Assistance</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Wallet Configuration Modal */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configuration Wallet Marchand</Text>
            <Text style={styles.modalDescription}>
              Entrez votre adresse Metamask pour recevoir les paiements
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0x..."
              value={walletInput}
              onChangeText={setWalletInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleSaveWallet}>
              <Text style={styles.modalButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8
  },
  settingsButton: {
    padding: 8
  },
  walletCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  walletLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4
  },
  walletAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    fontFamily: 'monospace'
  },
  balanceContainer: {
    backgroundColor: COLORS.secondary,
    margin: 16,
    marginTop: 0,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center'
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 8
  },
  balanceBNB: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 4
  },
  tokensContainer: {
    margin: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 12
  },
  tokenCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  tokenInfo: {
    flex: 1
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark
  },
  tokenName: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2
  },
  tokenBalance: {
    alignItems: 'flex-end'
  },
  tokenAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary
  },
  actionsContainer: {
    margin: 16
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
    flex: 1,
    marginHorizontal: 4
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center'
  },
  supportButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  supportButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 8
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 20
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 20
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  }
});
