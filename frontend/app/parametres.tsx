import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { configureMerchantWallet } from '../services/api';

export default function ParametresScreen() {
  const router = useRouter();
  const { merchantAddress, setMerchantAddress } = useWallet();
  
  // TPE Settings
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [usbEnabled, setUsbEnabled] = useState(false);
  const [testMode, setTestMode] = useState(true);
  
  // Wallet Modal
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletInput, setWalletInput] = useState('');

  const handleChangeWallet = async () => {
    if (!walletInput || walletInput.length !== 42) {
      Alert.alert('Erreur', 'Adresse wallet invalide');
      return;
    }

    try {
      await configureMerchantWallet(walletInput);
      await setMerchantAddress(walletInput);
      setShowWalletModal(false);
      Alert.alert('Succès', 'Wallet marchand mis à jour');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le wallet');
    }
  };

  const renderSettingRow = (icon: string, title: string, value: boolean, onToggle: (value: boolean) => void, disabled = false) => (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon as any} size={24} color={disabled ? COLORS.gray : COLORS.primary} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>{title}</Text>
          {disabled && <Text style={styles.comingSoon}>Bientôt disponible</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: COLORS.border, true: COLORS.success }}
        thumbColor={COLORS.white}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* TPE Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres TPE</Text>
          <View style={styles.card}>
            {renderSettingRow('wifi', 'NFC/Contact', nfcEnabled, setNfcEnabled, true)}
            {renderSettingRow('bluetooth', 'Bluetooth', bluetoothEnabled, setBluetoothEnabled, true)}
            {renderSettingRow('hardware-chip', 'USB-C', usbEnabled, setUsbEnabled, true)}
            {renderSettingRow('flask', 'Mode Test', testMode, setTestMode)}
          </View>
        </View>

        {/* Merchant Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compte Marchand</Text>
          <View style={styles.card}>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Adresse Metamask</Text>
              {merchantAddress ? (
                <Text style={styles.walletAddress}>
                  {merchantAddress.slice(0, 10)}...{merchantAddress.slice(-8)}
                </Text>
              ) : (
                <Text style={styles.walletEmpty}>Non configuré</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.changeWalletButton}
              onPress={() => {
                setWalletInput(merchantAddress || '');
                setShowWalletModal(true);
              }}
            >
              <Ionicons name="wallet" size={20} color={COLORS.primary} />
              <Text style={styles.changeWalletText}>
                {merchantAddress ? 'Changer le wallet' : 'Configurer le wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Blockchain Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations Blockchain</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Réseau:</Text>
              <Text style={styles.infoValue}>BSC Testnet</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Chain ID:</Text>
              <Text style={styles.infoValue}>97</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tokens supportés:</Text>
              <Text style={styles.infoValue}>XAF, EUROM, TND Stable</Text>
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionRow}>
              <Ionicons name="lock-closed" size={20} color={COLORS.gray} />
              <Text style={styles.actionText}>Configurer PIN</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow}>
              <Ionicons name="finger-print" size={20} color={COLORS.gray} />
              <Text style={styles.actionText}>Biométrie</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version:</Text>
              <Text style={styles.infoValue}>1.0.0 (Beta)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>TPE Crypto</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Change Wallet Modal */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Wallet Metamask</Text>
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
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowWalletModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleChangeWallet}
              >
                <Text style={styles.modalButtonPrimaryText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden'
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  settingRowDisabled: {
    opacity: 0.6
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  settingText: {
    marginLeft: 12,
    flex: 1
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark
  },
  settingTitleDisabled: {
    color: COLORS.gray
  },
  comingSoon: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2
  },
  walletInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
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
  walletEmpty: {
    fontSize: 14,
    color: COLORS.gray,
    fontStyle: 'italic'
  },
  changeWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  changeWalletText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.gray
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 12
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.light
  },
  modalButtonSecondaryText: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: '600'
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary
  },
  modalButtonPrimaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  }
});
