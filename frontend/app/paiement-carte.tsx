import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import jcopCardService, { CardReader, WalletInfo } from '../services/jcopCardService';

type PaymentStep = 'select_reader' | 'connecting' | 'waiting_card' | 'reading_card' | 'processing' | 'checking_balance' | 'success' | 'declined';

export default function PaiementCarteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [step, setStep] = useState<PaymentStep>('waiting_card');
  const [cardDetected, setCardDetected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [cardBalance, setCardBalance] = useState(0);

  const currency = params.currency as string;
  const amount = parseFloat(params.amount as string);
  const paymentMethod = params.method as string;

  // Simulation de la lecture de carte
  const simulateCardReading = () => {
    setStep('reading_card');
    
    // Étape 1 : Lecture de la carte (2 secondes)
    setTimeout(() => {
      setCardDetected(true);
      setWalletAddress('0x742D5Cc6bF2442E8C7c74c7b4Be6AB9d6f10f5B4');
      setStep('processing');
      
      // Étape 2 : Lecture du porte-monnaie (2 secondes)
      setTimeout(() => {
        const simulatedBalance = Math.random() * 1000; // Balance simulée
        setCardBalance(simulatedBalance);
        setStep('checking_balance');
        
        // Étape 3 : Vérification solde et signature (2 secondes)
        setTimeout(() => {
          if (simulatedBalance >= amount) {
            setStep('success');
          } else {
            setStep('declined');
          }
        }, 2000);
      }, 2000);
    }, 2000);
  };

  const handleInsertCard = () => {
    Alert.alert(
      'Insérer la carte',
      'Veuillez insérer votre carte à puce dans le lecteur',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Carte insérée', 
          onPress: simulateCardReading
        }
      ]
    );
  };

  const handleRetry = () => {
    setStep('waiting_card');
    setCardDetected(false);
    setWalletAddress('');
    setCardBalance(0);
  };

  const handleComplete = () => {
    router.push('/');
  };

  const getMethodIcon = () => {
    switch (paymentMethod) {
      case 'card_contact': return 'card';
      case 'card_usb': return 'hardware-chip';
      case 'card_bluetooth': return 'bluetooth';
      default: return 'card';
    }
  };

  const getMethodLabel = () => {
    switch (paymentMethod) {
      case 'card_contact': return 'Carte à puce (contact)';
      case 'card_usb': return 'Carte via câble USB-C';
      case 'card_bluetooth': return 'Carte via Bluetooth';
      default: return 'Carte à puce';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement par Carte</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Montant à payer */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant à payer</Text>
          <Text style={styles.amountValue}>
            {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}
          </Text>
        </View>

        {/* Méthode de paiement */}
        <View style={styles.methodCard}>
          <Ionicons name={getMethodIcon() as any} size={32} color={COLORS.primary} />
          <Text style={styles.methodText}>{getMethodLabel()}</Text>
        </View>

        {/* Étape 1 : Attente de la carte */}
        {step === 'waiting_card' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="card-outline" size={80} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Insérer la carte</Text>
            <Text style={styles.stepDescription}>
              Veuillez insérer votre carte à puce dans le lecteur TPE
            </Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleInsertCard}>
              <Text style={styles.actionButtonText}>Carte insérée</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 2 : Lecture de la carte */}
        {step === 'reading_card' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Lecture de la carte...</Text>
            <Text style={styles.stepDescription}>
              Ne retirez pas la carte
            </Text>
          </View>
        )}

        {/* Étape 3 : Traitement et reconnaissance du porte-monnaie */}
        {step === 'processing' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.warning} />
            <Text style={styles.stepTitle}>Reconnaissance du porte-monnaie</Text>
            <Text style={styles.stepDescription}>
              Lecture du solde de la carte...
            </Text>
            {walletAddress && (
              <View style={styles.walletInfoCard}>
                <Text style={styles.walletLabel}>Adresse détectée :</Text>
                <Text style={styles.walletAddressText}>
                  {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Étape 4 : Vérification du solde */}
        {step === 'checking_balance' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.stepTitle}>Vérification du solde</Text>
            <Text style={styles.stepDescription}>
              Signature de la transaction en cours...
            </Text>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Solde carte :</Text>
              <Text style={styles.balanceValue}>{cardBalance.toFixed(2)}</Text>
              <Text style={styles.balanceLabel}>Montant requis :</Text>
              <Text style={styles.balanceRequired}>{amount.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Étape 5a : Paiement accepté */}
        {step === 'success' && (
          <View style={styles.stepContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>ACCEPTÉ</Text>
            <Text style={styles.successDescription}>
              Paiement effectué avec succès
            </Text>

            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Montant débité :</Text>
                <Text style={styles.resultValue}>{amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Carte :</Text>
                <Text style={styles.resultValue}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Nouveau solde :</Text>
                <Text style={styles.resultValue}>{(cardBalance - amount).toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
              <Text style={styles.completeButtonText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 5b : Paiement refusé */}
        {step === 'declined' && (
          <View style={styles.stepContainer}>
            <View style={styles.declinedIcon}>
              <Ionicons name="close-circle" size={100} color={COLORS.danger} />
            </View>
            <Text style={styles.declinedTitle}>REFUSÉ</Text>
            <Text style={styles.declinedDescription}>
              Solde insuffisant sur la carte
            </Text>

            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Montant requis :</Text>
                <Text style={styles.resultValue}>{amount}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Solde disponible :</Text>
                <Text style={[styles.resultValue, { color: COLORS.danger }]}>
                  {cardBalance.toFixed(2)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Manquant :</Text>
                <Text style={[styles.resultValue, { color: COLORS.danger }]}>
                  {(amount - cardBalance).toFixed(2)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Réessayer avec une autre carte</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        {step === 'waiting_card' && (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Instructions :</Text>
            <View style={styles.instruction}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <Text style={styles.instructionText}>
                Insérer la carte dans le lecteur
              </Text>
            </View>
            <View style={styles.instruction}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <Text style={styles.instructionText}>
                La carte reconnaît automatiquement le porte-monnaie
              </Text>
            </View>
            <View style={styles.instruction}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <Text style={styles.instructionText}>
                Signature et débit automatique
              </Text>
            </View>
            <View style={styles.instruction}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>4</Text>
              </View>
              <Text style={styles.instructionText}>
                Le TPE affiche accepté ou refusé selon le solde
              </Text>
            </View>
          </View>
        )}
      </View>
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
    flex: 1,
    padding: 20
  },
  amountCard: {
    backgroundColor: COLORS.secondary,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 8
  },
  methodCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  methodText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginLeft: 12
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  iconContainer: {
    marginBottom: 24
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 12,
    textAlign: 'center'
  },
  stepDescription: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 20
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  },
  walletInfoCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  walletLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4
  },
  walletAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    fontFamily: 'monospace'
  },
  balanceCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16
  },
  balanceRequired: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark
  },
  successIcon: {
    marginBottom: 20
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: 12
  },
  successDescription: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 24,
    textAlign: 'center'
  },
  declinedIcon: {
    marginBottom: 20
  },
  declinedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 12
  },
  declinedDescription: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 24,
    textAlign: 'center'
  },
  resultCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  resultLabel: {
    fontSize: 14,
    color: COLORS.gray
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark
  },
  completeButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%'
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cancelButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  instructionsCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginTop: 20
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  instructionNumberText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600'
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dark
  }
});
