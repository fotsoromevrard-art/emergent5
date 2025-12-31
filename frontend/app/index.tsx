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
  Modal,
  Clipboard,
  Platform
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
  const [isValidating, setIsValidating] = useState(false);

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

  // Valider le format d'une adresse Ethereum
  const isValidEthAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSaveWallet = async () => {
    // Nettoyer l'adresse
    const cleanAddress = walletInput.trim();

    if (!cleanAddress) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse wallet');
      return;
    }

    if (!isValidEthAddress(cleanAddress)) {
      Alert.alert(
        'Adresse invalide',
        'L\'adresse doit commencer par 0x et contenir 40 caractères hexadécimaux.\n\nExemple: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      );
      return;
    }

    setIsValidating(true);
    
    try {
      await configureMerchantWallet(cleanAddress);
      await setMerchantAddress(cleanAddress);
      setShowWalletModal(false);
      setWalletInput('');
      Alert.alert(
        '✅ Configuration réussie',
        'Votre wallet Metamask est configuré.\n\nTous les paiements reçus seront crédités sur cette adresse.'
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de configurer le wallet. Réessayez.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePasteAddress = async () => {
    try {
      // Note: Clipboard API différente selon la plateforme
      if (Platform.OS === 'web') {
        const text = await navigator.clipboard.readText();
        setWalletInput(text);
      } else {
        // Pour mobile, utiliser @react-native-clipboard/clipboard si installé
        // Pour l'instant, afficher un message
        Alert.alert('Coller', 'Collez votre adresse depuis le presse-papier');
      }
    } catch (error) {
      console.log('Erreur clipboard:', error);
    }
  };

  const handleEditWallet = () => {
    setWalletInput(merchantAddress || '');
    setShowWalletModal(true);
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
          <TouchableOpacity style={styles.walletCard} onPress={handleEditWallet}>
            <View style={styles.walletHeader}>
              <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
              <Text style={styles.walletLabel}>Wallet Marchand (Metamask)</Text>
              <Ionicons name="pencil-outline" size={16} color={COLORS.gray} />
            </View>
            <Text style={styles.walletAddress}>
              {merchantAddress.slice(0, 14)}...{merchantAddress.slice(-10)}
            </Text>
            <Text style={styles.walletHint}>Appuyez pour modifier</Text>
          </TouchableOpacity>
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
        onRequestClose={() => merchantAddress && setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="wallet" size={40} color={COLORS.primary} />
              <Text style={styles.modalTitle}>Wallet Marchand</Text>
            </View>
            
            <Text style={styles.modalDescription}>
              Entrez l'adresse de votre portefeuille Metamask.{'\n'}
              C'est sur cette adresse que vous recevrez tous les paiements.
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Adresse Metamask (BSC)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0x742d35Cc6634C0532925a3b..."
                  value={walletInput}
                  onChangeText={setWalletInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={COLORS.gray}
                />
                {Platform.OS === 'web' && (
                  <TouchableOpacity style={styles.pasteButton} onPress={handlePasteAddress}>
                    <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
              {walletInput.length > 0 && !isValidEthAddress(walletInput) && (
                <Text style={styles.inputError}>
                  Format invalide. L'adresse doit commencer par 0x et avoir 42 caractères.
                </Text>
              )}
              {walletInput.length > 0 && isValidEthAddress(walletInput) && (
                <Text style={styles.inputValid}>
                  ✓ Adresse valide
                </Text>
              )}
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={COLORS.secondary} />
              <Text style={styles.infoText}>
                Réseau: BNB Smart Chain (BSC){'\n'}
                Devises supportées: XAF, EUROM, TND
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.modalButton, 
                (!walletInput || !isValidEthAddress(walletInput) || isValidating) && styles.modalButtonDisabled
              ]} 
              onPress={handleSaveWallet}
              disabled={!walletInput || !isValidEthAddress(walletInput) || isValidating}
            >
              {isValidating ? (
                <Text style={styles.modalButtonText}>Validation...</Text>
              ) : (
                <Text style={styles.modalButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
            
            {merchantAddress && (
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowWalletModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}
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
