/**
 * Écran de paiement par carte
 * Mode démonstration compatible Expo Go
 * 
 * Ce flux simule le processus de paiement pour permettre
 * de tester l'interface utilisateur complète.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { PlatformService } from '../services/platformService';
import cardReaderService, { CardReaderDevice, CardInfo } from '../services/cardReaderService';
import { useWallet } from '../context/WalletContext';

type PaymentStep = 
  | 'connecting'      // Connexion au lecteur
  | 'waiting_card'    // Attente insertion carte
  | 'reading_card'    // Lecture de la carte
  | 'processing'      // Traitement du paiement
  | 'success'         // Paiement réussi
  | 'error';          // Erreur

export default function PaiementCarteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { merchantAddress } = useWallet();
  
  // États
  const [step, setStep] = useState<PaymentStep>('connecting');
  const [connectedReader, setConnectedReader] = useState<CardReaderDevice | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [isDemoMode] = useState(PlatformService.isDemoMode);

  // Paramètres du paiement
  const currency = params.currency as string || 'XAF';
  const amount = parseFloat(params.amount as string) || 0;

  useEffect(() => {
    startConnectionProcess();
    
    return () => {
      // Nettoyage
      cardReaderService.disconnect();
    };
  }, []);

  // =============== PROCESSUS DE CONNEXION ===============

  const startConnectionProcess = async () => {
    setStep('connecting');
    setError('');

    try {
      // Rechercher les lecteurs
      const readers = await cardReaderService.scanForReaders();
      
      if (readers.length === 0) {
        throw new Error('Aucun lecteur trouvé');
      }

      // Se connecter au premier lecteur trouvé
      const reader = readers[0];
      const connected = await cardReaderService.connect(reader);
      
      if (!connected) {
        throw new Error('Impossible de se connecter au lecteur');
      }

      setConnectedReader(reader);
      setStep('waiting_card');
      
      // Démarrer la détection de carte
      detectCard();
      
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
      setStep('error');
    }
  };

  // =============== DÉTECTION DE CARTE ===============

  const detectCard = async () => {
    try {
      // Attendre un peu pour l'effet visuel
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const card = await cardReaderService.checkCard();
      
      if (card.present && card.type === 'jcop_valid') {
        setCardInfo(card);
        setStep('reading_card');
        
        // Procéder au paiement après un court délai
        setTimeout(() => processPayment(), 1500);
      } else if (card.present && card.type === 'jcop_blank') {
        setError('Carte vierge détectée. Utilisez une carte programmée.');
        setStep('error');
      } else if (card.present && card.type === 'bank_card') {
        setError('Carte bancaire non supportée. Utilisez une carte JCOP.');
        setStep('error');
      } else {
        // Carte non détectée, réessayer
        detectCard();
      }
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // =============== TRAITEMENT DU PAIEMENT ===============

  const processPayment = async () => {
    setStep('processing');
    
    try {
      const result = await cardReaderService.processPayment(amount, currency);
      
      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setStep('success');
      } else {
        throw new Error(result.error || 'Échec du paiement');
      }
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // =============== HANDLERS ===============

  const handleRetry = () => {
    setError('');
    startConnectionProcess();
  };

  const handleNewPayment = () => {
    router.replace('/nouveau-paiement');
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  // =============== RENDU DES ÉTAPES ===============

  const renderStepContent = () => {
    switch (step) {
      case 'connecting':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Connexion au lecteur...</Text>
            <Text style={styles.stepSubtitle}>
              Recherche du lecteur de carte
            </Text>
            {isDemoMode && (
              <View style={styles.demoBadge}>
                <Ionicons name="information-circle" size={16} color={COLORS.warning} />
                <Text style={styles.demoText}>Mode démonstration</Text>
              </View>
            )}
          </View>
        );

      case 'waiting_card':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="card-outline" size={80} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Insérez la carte</Text>
            <Text style={styles.stepSubtitle}>
              Insérez la carte à puce dans le lecteur
            </Text>
            <View style={styles.readerInfo}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.readerName}>{connectedReader?.name}</Text>
            </View>
            <ActivityIndicator size="small" color={COLORS.gray} style={{ marginTop: 20 }} />
          </View>
        );

      case 'reading_card':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.cardIconContainer, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="card" size={80} color={COLORS.success} />
            </View>
            <Text style={styles.stepTitle}>Carte détectée</Text>
            <Text style={styles.stepSubtitle}>
              {cardInfo?.message || 'Lecture en cours...'}
            </Text>
            <ActivityIndicator size="small" color={COLORS.success} style={{ marginTop: 20 }} />
          </View>
        );

      case 'processing':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.stepTitle}>Traitement en cours</Text>
            <Text style={styles.stepSubtitle}>
              Signature de la transaction...
            </Text>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Montant</Text>
              <Text style={styles.amountValue}>
                {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
              </Text>
            </View>
          </View>
        );

      case 'success':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>Paiement réussi !</Text>
            <View style={styles.successCard}>
              <Text style={styles.successAmount}>
                {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
              </Text>
              {txHash && (
                <View style={styles.txHashContainer}>
                  <Text style={styles.txHashLabel}>Transaction ID</Text>
                  <Text style={styles.txHash}>
                    {txHash.slice(0, 20)}...{txHash.slice(-10)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.successButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleNewPayment}>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Nouveau paiement</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome}>
                <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'error':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.errorIcon}>
              <Ionicons name="close-circle" size={100} color={COLORS.danger} />
            </View>
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <View style={styles.errorButtons}>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Ionicons name="refresh" size={24} color={COLORS.white} />
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleGoHome}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement par carte</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Résumé du paiement */}
      {step !== 'success' && step !== 'error' && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
          </Text>
        </View>
      )}

      {/* Contenu principal */}
      <ScrollView contentContainerStyle={styles.content}>
        {renderStepContent()}
      </ScrollView>

      {/* Footer info en mode démo */}
      {isDemoMode && step !== 'success' && step !== 'error' && (
        <View style={styles.demoFooter}>
          <Ionicons name="flask" size={16} color={COLORS.warning} />
          <Text style={styles.demoFooterText}>
            Mode démonstration - Le flux est simulé
          </Text>
        </View>
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
  summaryBar: {
    backgroundColor: COLORS.secondary,
    padding: 12,
    alignItems: 'center'
  },
  summaryText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600'
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  stepContainer: {
    alignItems: 'center'
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginTop: 24,
    textAlign: 'center'
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center'
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 20
  },
  demoText: {
    color: COLORS.warning,
    marginLeft: 6,
    fontWeight: '500'
  },
  cardIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  readerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20
  },
  readerName: {
    marginLeft: 8,
    color: COLORS.dark,
    fontWeight: '500'
  },
  amountCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
    width: '100%'
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.gray
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4
  },
  successIcon: {
    marginBottom: 16
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.success
  },
  successCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 16,
    marginTop: 24,
    width: '100%',
    alignItems: 'center'
  },
  successAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  txHashContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: '100%',
    alignItems: 'center'
  },
  txHashLabel: {
    fontSize: 12,
    color: COLORS.gray
  },
  txHash: {
    fontSize: 12,
    color: COLORS.dark,
    fontFamily: 'monospace',
    marginTop: 4
  },
  successButtons: {
    width: '100%',
    marginTop: 32
  },
  primaryButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 12
  },
  secondaryButtonText: {
    color: COLORS.gray,
    fontSize: 16
  },
  errorIcon: {
    marginBottom: 16
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.danger
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12
  },
  errorButtons: {
    width: '100%',
    marginTop: 32
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 12
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontSize: 16
  },
  demoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning + '20',
    padding: 12
  },
  demoFooterText: {
    color: COLORS.warning,
    marginLeft: 8,
    fontSize: 12
  }
});
