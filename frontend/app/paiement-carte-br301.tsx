/**
 * Écran de paiement par carte via Feitian bR301
 * 
 * Supporte :
 * - Mode USB réel (sur APK Android custom)
 * - Mode simulation (sur Expo Go / Web)
 * 
 * Détection des cartes :
 * ✅ Carte JCOP programmée → Acceptée
 * ❌ Carte JCOP vierge → Rejetée  
 * 🚫 Carte bancaire → Refusée
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import cardReaderService, { 
  CardReaderDevice, 
  CardInfo, 
  initCardReader 
} from '../services/cardReaderService';
import { useWallet } from '../context/WalletContext';

type PaymentStep = 
  | 'initializing'       // Initialisation du service
  | 'scanning'           // Recherche des lecteurs
  | 'connecting'         // Connexion au lecteur
  | 'waiting_card'       // Attente insertion carte
  | 'detecting_card'     // Détection du type de carte
  | 'card_rejected'      // Carte rejetée
  | 'processing'         // Traitement du paiement
  | 'success'            // Paiement réussi
  | 'error';             // Erreur

export default function PaiementCarteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { merchantAddress } = useWallet();
  
  // États
  const [step, setStep] = useState<PaymentStep>('initializing');
  const [mode, setMode] = useState<'usb' | 'simulation'>('simulation');
  const [readers, setReaders] = useState<CardReaderDevice[]>([]);
  const [connectedReader, setConnectedReader] = useState<CardReaderDevice | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [signature, setSignature] = useState<string>('');

  // Paramètres du paiement
  const currency = params.currency as string || 'XAF_STABLE';
  const amount = parseFloat(params.amount as string) || 0;

  // Initialisation
  useEffect(() => {
    initializeService();
    
    return () => {
      // Nettoyage à la fermeture
      cardReaderService.disconnect();
    };
  }, []);

  // =============== INITIALISATION ===============

  const initializeService = async () => {
    setStep('initializing');
    
    try {
      // Initialiser le service de lecteur de carte
      const result = await initCardReader();
      setMode(result.mode);
      
      // Passer au scan des lecteurs
      await scanForReaders();
    } catch (err: any) {
      setError('Erreur d\'initialisation');
      setStep('error');
    }
  };

  // =============== SCAN DES LECTEURS ===============

  const scanForReaders = async () => {
    setStep('scanning');
    setError('');

    try {
      const foundReaders = await cardReaderService.scanForReaders();
      setReaders(foundReaders);

      if (foundReaders.length === 0) {
        setError('Aucun lecteur trouvé. Connectez votre bR301 via USB-C.');
        setStep('error');
        return;
      }

      // Si un seul lecteur, se connecter automatiquement
      if (foundReaders.length === 1) {
        await connectToReader(foundReaders[0]);
      } else {
        // Afficher la liste pour sélection
        // Pour l'instant, prendre le premier
        await connectToReader(foundReaders[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de scan');
      setStep('error');
    }
  };

  // =============== CONNEXION AU LECTEUR ===============

  const connectToReader = async (reader: CardReaderDevice) => {
    setStep('connecting');

    try {
      const connected = await cardReaderService.connect(reader);
      
      if (connected) {
        setConnectedReader(cardReaderService.getConnectedReader());
        setStep('waiting_card');
        
        // Démarrer la détection de carte
        startCardDetection();
      } else {
        setError('Impossible de se connecter au lecteur');
        setStep('error');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
      setStep('error');
    }
  };

  // =============== DÉTECTION DE CARTE ===============

  const startCardDetection = useCallback(async () => {
    // Attendre un peu pour l'animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setStep('detecting_card');

    try {
      const card = await cardReaderService.checkCard();
      setCardInfo(card);

      if (!card.present) {
        // Pas de carte, réessayer
        setTimeout(startCardDetection, 1000);
        setStep('waiting_card');
        return;
      }

      if (card.supported && card.type === 'jcop_valid') {
        // Carte valide, procéder au paiement
        setTimeout(() => processPayment(), 1000);
      } else {
        // Carte non supportée
        let errorMsg = 'Carte non reconnue';
        
        if (card.type === 'jcop_blank') {
          errorMsg = 'Cette carte JCOP n\'est pas programmée. Utilisez une carte avec l\'applet Crypto Wallet installé.';
        } else if (card.type === 'bank_card') {
          errorMsg = 'Les cartes bancaires (Visa/Mastercard) ne sont pas supportées. Ce terminal utilise uniquement des cartes JCOP.';
        }
        
        setError(errorMsg);
        setStep('card_rejected');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de détection');
      setStep('error');
    }
  }, []);

  // =============== TRAITEMENT DU PAIEMENT ===============

  const processPayment = async () => {
    if (!merchantAddress) {
      setError('Adresse marchand non configurée');
      setStep('error');
      return;
    }

    setStep('processing');

    try {
      const result = await cardReaderService.processPayment(
        amount,
        currency,
        merchantAddress
      );

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        if (result.signature) {
          setSignature(result.signature);
        }
        setStep('success');
      } else {
        setError(result.error || 'Échec du paiement');
        setStep('error');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de paiement');
      setStep('error');
    }
  };

  // =============== HANDLERS ===============

  const handleRetry = () => {
    setError('');
    setCardInfo(null);
    initializeService();
  };

  const handleNewPayment = () => {
    router.replace('/nouveau-paiement');
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleRetryCard = () => {
    setError('');
    setCardInfo(null);
    setStep('waiting_card');
    startCardDetection();
  };

  // =============== RENDU ===============

  const renderModeIndicator = () => {
    if (mode === 'simulation') {
      return (
        <View style={styles.modeIndicator}>
          <Ionicons name="flask" size={14} color={COLORS.warning} />
          <Text style={styles.modeText}>Mode Simulation</Text>
        </View>
      );
    }
    return (
      <View style={[styles.modeIndicator, { backgroundColor: COLORS.success + '20' }]}>
        <Ionicons name="hardware-chip" size={14} color={COLORS.success} />
        <Text style={[styles.modeText, { color: COLORS.success }]}>Mode USB</Text>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 'initializing':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Initialisation...</Text>
            <Text style={styles.stepSubtitle}>
              Préparation du service de lecture
            </Text>
          </View>
        );

      case 'scanning':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Recherche du lecteur...</Text>
            <Text style={styles.stepSubtitle}>
              Connectez votre Feitian bR301 via USB-C
            </Text>
            {renderModeIndicator()}
          </View>
        );

      case 'connecting':
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.stepTitle}>Connexion au lecteur...</Text>
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
            {connectedReader && (
              <View style={styles.readerInfo}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.readerName}>{connectedReader.name}</Text>
              </View>
            )}
            <ActivityIndicator size="small" color={COLORS.gray} style={{ marginTop: 20 }} />
            {renderModeIndicator()}
          </View>
        );

      case 'detecting_card':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.cardIconContainer, { backgroundColor: COLORS.secondary + '20' }]}>
              <Ionicons name="scan" size={80} color={COLORS.secondary} />
            </View>
            <Text style={styles.stepTitle}>Lecture de la carte...</Text>
            <Text style={styles.stepSubtitle}>
              Identification en cours
            </Text>
            <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 20 }} />
          </View>
        );

      case 'card_rejected':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.cardIconContainer, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="close-circle" size={80} color={COLORS.danger} />
            </View>
            <Text style={[styles.stepTitle, { color: COLORS.danger }]}>
              Carte non acceptée
            </Text>
            <Text style={styles.errorMessage}>{error}</Text>
            
            {cardInfo && (
              <View style={styles.cardInfoBox}>
                <Text style={styles.cardInfoLabel}>Type détecté:</Text>
                <Text style={styles.cardInfoValue}>{cardInfo.typeName}</Text>
                {cardInfo.atr && (
                  <>
                    <Text style={styles.cardInfoLabel}>ATR:</Text>
                    <Text style={styles.cardInfoATR}>{cardInfo.atr}</Text>
                  </>
                )}
              </View>
            )}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetryCard}>
                <Ionicons name="refresh" size={20} color={COLORS.white} />
                <Text style={styles.retryButtonText}>Essayer une autre carte</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleGoHome}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
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
            {cardInfo && (
              <View style={styles.cardValidBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={styles.cardValidText}>{cardInfo.typeName}</Text>
              </View>
            )}
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
              {signature && (
                <View style={styles.signatureContainer}>
                  <Text style={styles.txHashLabel}>Signature</Text>
                  <Text style={styles.txHash}>
                    {signature.slice(0, 20)}...
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
              <Ionicons name="alert-circle" size={100} color={COLORS.danger} />
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

      default:
        return null;
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
      {step !== 'success' && step !== 'error' && step !== 'card_rejected' && (
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

      {/* Footer info */}
      {mode === 'simulation' && !['success', 'error', 'card_rejected'].includes(step) && (
        <View style={styles.demoFooter}>
          <Ionicons name="information-circle" size={16} color={COLORS.warning} />
          <Text style={styles.demoFooterText}>
            Mode simulation - Utilisez un APK custom pour le mode USB réel
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
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 20
  },
  modeText: {
    color: COLORS.warning,
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 12
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
  cardValidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16
  },
  cardValidText: {
    marginLeft: 6,
    color: COLORS.success,
    fontWeight: '500'
  },
  cardInfoBox: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    width: '100%'
  },
  cardInfoLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8
  },
  cardInfoValue: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: '500'
  },
  cardInfoATR: {
    fontSize: 10,
    color: COLORS.gray,
    fontFamily: 'monospace'
  },
  buttonContainer: {
    width: '100%',
    marginTop: 24
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
  signatureContainer: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center'
  },
  txHashLabel: {
    fontSize: 12,
    color: COLORS.gray
  },
  txHash: {
    fontSize: 11,
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
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 22
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
    fontSize: 16,
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
    backgroundColor: COLORS.warning + '15',
    padding: 10
  },
  demoFooterText: {
    color: COLORS.warning,
    marginLeft: 8,
    fontSize: 11
  }
});
