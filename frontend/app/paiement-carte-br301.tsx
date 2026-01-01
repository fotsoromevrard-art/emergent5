/**
 * Écran de paiement carte via Feitian bR301-BLE
 * Supporte Bluetooth BLE et USB-C
 * 
 * Détection des cartes :
 * ✅ Carte JCOP programmée (Infineon SLE78) → Acceptée
 * ❌ Carte JCOP vierge → Rejetée
 * 🚫 Carte bancaire Visa/Mastercard → Refusée
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { PlatformService } from '../services/platformService';
import br301BleService, { BR301Device, CardInfo } from '../services/br301BleService';
import br301UsbService, { BR301USBDevice } from '../services/br301UsbService';
import jcopWalletService from '../services/jcopWalletService';
import cardDetectionService, { CardDetectionResult, CardValidationResult } from '../services/cardDetectionService';
import { useWallet } from '../context/WalletContext';

type ConnectionMode = 'select' | 'bluetooth' | 'usb';
type PaymentStep = 
  | 'select_mode'        // Choisir BLE ou USB
  | 'scanning'           // Recherche des lecteurs
  | 'select_reader'      // Sélection du lecteur trouvé
  | 'connecting'         // Connexion en cours
  | 'waiting_card'       // Attente insertion carte
  | 'detecting_card'     // Détection du type de carte
  | 'card_rejected'      // Carte rejetée (vierge ou bancaire)
  | 'reading_card'       // Lecture de la carte valide
  | 'processing'         // Traitement du paiement
  | 'success'            // Paiement réussi
  | 'error';             // Erreur

interface ReaderDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'usb';
  rssi?: number | null;
  device: any;
}

export default function PaiementCarteBR301Screen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { merchantAddress, selectedNetwork } = useWallet();
  
  // États
  const [step, setStep] = useState<PaymentStep>('select_mode');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('select');
  const [readers, setReaders] = useState<ReaderDevice[]>([]);
  const [selectedReader, setSelectedReader] = useState<ReaderDevice | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [cardDetectionResult, setCardDetectionResult] = useState<CardDetectionResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isWebMode, setIsWebMode] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  // Paramètres du paiement
  const currency = params.currency as string || 'XAF';
  const amount = parseFloat(params.amount as string) || 0;

  useEffect(() => {
    // Détecter si on est sur le web
    setIsWebMode(PlatformService.isWeb);
    
    return () => {
      // Nettoyage
      br301BleService.stopCardMonitoring();
      br301UsbService.stopAutoDetection();
      jcopWalletService.reset();
    };
  }, []);

  // =============== SÉLECTION DU MODE ===============

  const handleSelectBluetooth = async () => {
    setConnectionMode('bluetooth');
    setStep('scanning');
    setError('');
    
    try {
      const devices = await br301BleService.scanForBR301(15000);
      
      const mappedDevices: ReaderDevice[] = devices.map(d => ({
        id: d.id,
        name: d.name,
        type: 'bluetooth' as const,
        rssi: d.rssi,
        device: d.device
      }));

      setReaders(mappedDevices);
      
      if (mappedDevices.length === 0) {
        setError('Aucun lecteur bR301-BLE trouvé. Vérifiez qu\'il est allumé.');
        setStep('select_mode');
      } else {
        setStep('select_reader');
      }
    } catch (err: any) {
      console.error('Erreur scan BLE:', err);
      setError(err.message || 'Erreur lors du scan Bluetooth');
      setStep('select_mode');
    }
  };

  const handleSelectUSB = async () => {
    setConnectionMode('usb');
    setStep('scanning');
    setError('');
    
    // Démarrer la détection automatique USB
    br301UsbService.startAutoDetection((devices) => {
      const mappedDevices: ReaderDevice[] = devices.map(d => ({
        id: d.id,
        name: d.name,
        type: 'usb' as const,
        device: d.device
      }));

      setReaders(mappedDevices);
      
      if (mappedDevices.length > 0) {
        br301UsbService.stopAutoDetection();
        setStep('select_reader');
      }
    }, 2000);

    // Timeout après 30 secondes
    setTimeout(() => {
      if (readers.length === 0) {
        br301UsbService.stopAutoDetection();
        setError('Aucun lecteur USB détecté. Connectez votre bR301 via USB-C.');
        setStep('select_mode');
      }
    }, 30000);
  };

  // =============== CONNEXION AU LECTEUR ===============

  const handleSelectReader = async (reader: ReaderDevice) => {
    setSelectedReader(reader);
    setStep('connecting');
    setError('');

    try {
      let connected = false;

      if (reader.type === 'bluetooth') {
        const bleDevice: BR301Device = {
          id: reader.id,
          name: reader.name,
          rssi: reader.rssi || null,
          connected: false,
          device: reader.device
        };
        connected = await br301BleService.connect(bleDevice);
      } else {
        const usbDevice: BR301USBDevice = {
          id: reader.id,
          name: reader.name,
          connected: false,
          device: reader.device
        };
        connected = await br301UsbService.connect(usbDevice);
      }

      if (connected) {
        setStep('waiting_card');
        startCardMonitoring();
      } else {
        setError('Impossible de se connecter au lecteur');
        setStep('select_reader');
      }
    } catch (err: any) {
      console.error('Erreur connexion:', err);
      setError(err.message || 'Erreur de connexion');
      setStep('select_reader');
    }
  };

  // =============== SURVEILLANCE CARTE ===============

  const startCardMonitoring = () => {
    // Définir le type de connexion pour le service JCOP
    jcopWalletService.setConnectionType(connectionMode === 'bluetooth' ? 'bluetooth' : 'usb');
    
    if (connectionMode === 'bluetooth') {
      br301BleService.startCardMonitoring(
        (info) => {
          console.log('Carte détectée:', info);
          setCardInfo(info);
          handleCardInserted(info);
        },
        () => {
          console.log('Carte retirée');
          setCardInfo(null);
          setCardDetectionResult(null);
        },
        1000
      );
    }
    // Pour USB, on doit implémenter une logique similaire
  };

  const handleCardInserted = async (info: CardInfo) => {
    // Étape 1: Détection du type de carte
    setStep('detecting_card');
    
    try {
      // Obtenir l'ATR de la carte
      const atr = info.atr || '3B 68 00 00 00 73 C8 40 01 00 90 00'; // ATR par défaut pour test
      
      console.log('🔍 Détection de la carte...');
      console.log('   ATR:', atr);
      
      // Détecter et valider la carte
      const detectionResult = await jcopWalletService.detectAndValidateCard(atr);
      setCardDetectionResult(detectionResult);
      
      console.log('📋 Résultat détection:', detectionResult.type, detectionResult.validation);
      
      // Vérifier le résultat
      if (detectionResult.validation === 'VALID') {
        // ✅ Carte JCOP programmée - Procéder au paiement
        console.log('✅ Carte valide - Procéder au paiement');
        setStep('reading_card');
        await processPayment();
        
      } else if (detectionResult.validation === 'REJECTED_BANKING') {
        // 🚫 Carte bancaire Visa/Mastercard - REFUS
        console.log('🚫 Carte bancaire détectée - REFUS');
        setStep('card_rejected');
        setError(detectionResult.message);
        
      } else if (detectionResult.validation === 'REJECTED_EMPTY') {
        // ❌ Carte JCOP vierge - REJET
        console.log('❌ Carte vierge - REJET');
        setStep('card_rejected');
        setError(detectionResult.message);
        
      } else {
        // ⚠️ Carte inconnue - REJET
        console.log('⚠️ Carte inconnue - REJET');
        setStep('card_rejected');
        setError(detectionResult.message);
      }
      
    } catch (err: any) {
      console.error('Erreur détection carte:', err);
      setError(err.message || 'Erreur lors de la détection de la carte');
      setStep('error');
    }
  };

  // =============== TRAITEMENT DU PAIEMENT ===============

  const processPayment = async () => {
    setStep('processing');
    
    try {
      // Vérifier que l'adresse marchand est configurée
      if (!merchantAddress) {
        throw new Error('Adresse du wallet marchand non configurée');
      }
      
      console.log('💳 Traitement du paiement...');
      console.log('   Montant:', amount, currency);
      console.log('   Destinataire:', merchantAddress);
      
      // Effectuer le paiement via la carte
      const result = await jcopWalletService.processPayment(
        merchantAddress,
        amount,
        currency
      );
      
      if (result.success) {
        console.log('✅ Paiement réussi !');
        console.log('   TX Hash:', result.txHash);
        setTxHash(result.txHash || '');
        setStep('success');
      } else {
        throw new Error(result.error || 'Erreur lors du paiement');
      }
      
    } catch (err: any) {
      console.error('Erreur paiement:', err);
      setError(err.message || 'Erreur lors du paiement');
      setStep('error');
    }
  };
    }
  };

  // =============== ACTIONS ===============

  const handleManualCardInsert = () => {
    // Pour les tests ou si la détection automatique ne fonctionne pas
    const mockCardInfo: CardInfo = {
      present: true,
      atr: '3B 68 00 00 00 73 C8 40 01 00 90 00',
      protocol: 'T0'
    };
    setCardInfo(mockCardInfo);
    handleCardInserted(mockCardInfo);
  };

  const handleRetry = () => {
    setStep('select_mode');
    setConnectionMode('select');
    setReaders([]);
    setSelectedReader(null);
    setCardInfo(null);
    setError('');
  };

  const handleComplete = async () => {
    await br301BleService.disconnect();
    await br301UsbService.disconnect();
    router.push('/');
  };

  const handleCancel = async () => {
    await br301BleService.disconnect();
    await br301UsbService.disconnect();
    router.back();
  };

  // =============== RENDU ===============

  const renderModeSelection = () => (
    <View style={styles.modeContainer}>
      <Text style={styles.modeTitle}>Connexion au lecteur bR301-BLE</Text>
      <Text style={styles.modeSubtitle}>Comment voulez-vous connecter le lecteur ?</Text>
      
      {isWebMode && (
        <View style={styles.webWarning}>
          <Ionicons name="warning" size={24} color={COLORS.warning} />
          <Text style={styles.webWarningText}>
            Mode web détecté. Les fonctionnalités Bluetooth et USB sont simulées.
            Utilisez l'application mobile pour une vraie connexion.
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.modeButton}
        onPress={handleSelectBluetooth}
      >
        <View style={styles.modeIcon}>
          <Ionicons name="bluetooth" size={40} color={COLORS.primary} />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeButtonTitle}>Bluetooth BLE</Text>
          <Text style={styles.modeButtonDesc}>Connexion sans fil</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.modeButton}
        onPress={handleSelectUSB}
      >
        <View style={styles.modeIcon}>
          <Ionicons name="hardware-chip" size={40} color={COLORS.secondary} />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeButtonTitle}>USB-C</Text>
          <Text style={styles.modeButtonDesc}>Connexion filaire</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
      </TouchableOpacity>
    </View>
  );

  const renderScanning = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.scanningTitle}>
        {connectionMode === 'bluetooth' 
          ? 'Recherche Bluetooth...' 
          : 'Détection USB...'}
      </Text>
      <Text style={styles.scanningSubtitle}>
        {connectionMode === 'bluetooth'
          ? 'Assurez-vous que le bR301-BLE est allumé'
          : 'Connectez le bR301 via USB-C'}
      </Text>
      
      <TouchableOpacity style={styles.cancelScanButton} onPress={handleRetry}>
        <Text style={styles.cancelScanText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReaderItem = ({ item }: { item: ReaderDevice }) => (
    <TouchableOpacity
      style={styles.readerCard}
      onPress={() => handleSelectReader(item)}
    >
      <View style={styles.readerIcon}>
        <Ionicons 
          name={item.type === 'bluetooth' ? 'bluetooth' : 'hardware-chip'} 
          size={32} 
          color={COLORS.primary} 
        />
      </View>
      <View style={styles.readerInfo}>
        <Text style={styles.readerName}>{item.name}</Text>
        <Text style={styles.readerType}>
          {item.type === 'bluetooth' ? `Bluetooth (RSSI: ${item.rssi || 'N/A'})` : 'USB'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
    </TouchableOpacity>
  );

  const renderReaderSelection = () => (
    <View style={styles.listContainer}>
      <Text style={styles.listTitle}>Lecteurs trouvés</Text>
      <FlatList
        data={readers}
        renderItem={renderReaderItem}
        keyExtractor={item => item.id}
        style={styles.readersList}
      />
      <TouchableOpacity style={styles.rescanButton} onPress={handleRetry}>
        <Ionicons name="refresh" size={20} color={COLORS.primary} />
        <Text style={styles.rescanText}>Nouvelle recherche</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConnecting = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.connectingTitle}>Connexion en cours...</Text>
      <Text style={styles.connectingSubtitle}>{selectedReader?.name}</Text>
    </View>
  );

  const renderWaitingCard = () => (
    <View style={styles.centerContainer}>
      <View style={styles.cardIconContainer}>
        <Ionicons name="card-outline" size={80} color={COLORS.primary} />
      </View>
      <Text style={styles.waitingTitle}>Insérez votre carte</Text>
      <Text style={styles.waitingSubtitle}>
        Placez la carte à puce dans le lecteur {selectedReader?.name}
      </Text>
      
      <View style={styles.readerStatusCard}>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
        <Text style={styles.readerStatusText}>Lecteur connecté</Text>
      </View>

      {/* Bouton manuel pour les tests */}
      <TouchableOpacity 
        style={styles.manualButton}
        onPress={handleManualCardInsert}
      >
        <Text style={styles.manualButtonText}>Carte insérée (Manuel)</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReadingCard = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.secondary} />
      <Text style={styles.readingTitle}>Lecture de la carte...</Text>
      {cardInfo?.atr && (
        <Text style={styles.atrText}>ATR: {cardInfo.atr}</Text>
      )}
      {cardDetectionResult && (
        <View style={styles.cardTypeInfo}>
          <Text style={styles.cardTypeText}>
            Type: {cardDetectionResult.details.isInfineon ? 'Infineon SLE78' : 'JCOP'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderDetectingCard = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.detectingTitle}>Détection de la carte...</Text>
      <Text style={styles.detectingSubtitle}>Vérification du type et de la programmation</Text>
      {cardInfo?.atr && (
        <Text style={styles.atrText}>ATR: {cardInfo.atr}</Text>
      )}
    </View>
  );

  const renderCardRejected = () => {
    const errorInfo = cardDetectionResult 
      ? cardDetectionService.getErrorMessage(cardDetectionResult.validation)
      : { title: 'Carte rejetée', message: error, icon: 'alert-circle' };
    
    // Déterminer l'icône et la couleur selon le type de rejet
    const isBankingCard = cardDetectionResult?.type === 'VISA_MASTERCARD';
    const iconName = isBankingCard ? 'card-outline' : 'alert-circle';
    const iconColor = isBankingCard ? COLORS.danger : COLORS.warning;
    
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.rejectedIcon, { backgroundColor: isBankingCard ? '#FEE2E2' : '#FEF3C7' }]}>
          <Ionicons name={iconName as any} size={80} color={iconColor} />
        </View>
        
        <Text style={[styles.rejectedTitle, { color: iconColor }]}>
          {isBankingCard ? 'CARTE NON CONFORME' : 'CARTE REJETÉE'}
        </Text>
        
        <Text style={styles.rejectedSubtitle}>{errorInfo.title}</Text>
        
        <View style={styles.rejectedMessageBox}>
          <Text style={styles.rejectedMessage}>{errorInfo.message}</Text>
        </View>
        
        {cardDetectionResult?.atr && (
          <View style={styles.atrContainer}>
            <Text style={styles.atrLabel}>ATR détecté:</Text>
            <Text style={styles.atrValue}>{cardDetectionResult.atr}</Text>
          </View>
        )}
        
        {isBankingCard && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={COLORS.danger} />
            <Text style={styles.warningText}>
              Les cartes bancaires Visa/Mastercard ne sont pas compatibles avec ce terminal de paiement crypto.
            </Text>
          </View>
        )}
        
        <View style={styles.expectedCardInfo}>
          <Text style={styles.expectedCardTitle}>Carte attendue:</Text>
          <Text style={styles.expectedCardText}>• Infineon SLE78CLFX4000PM</Text>
          <Text style={styles.expectedCardText}>• Programmée avec applet crypto</Text>
          <Text style={styles.expectedCardText}>• Certification FIPS 140-2 Level 3</Text>
        </View>
        
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={20} color={COLORS.white} />
          <Text style={styles.retryButtonText}>Essayer une autre carte</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderProcessing = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.warning} />
      <Text style={styles.processingTitle}>Traitement du paiement...</Text>
      <Text style={styles.processingAmount}>
        {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
      </Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.centerContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
      </View>
      <Text style={styles.successTitle}>PAIEMENT ACCEPTÉ</Text>
      <Text style={styles.successAmount}>
        {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
      </Text>
      
      <View style={styles.successDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Lecteur:</Text>
          <Text style={styles.detailValue}>{selectedReader?.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Connexion:</Text>
          <Text style={styles.detailValue}>
            {connectionMode === 'bluetooth' ? 'Bluetooth' : 'USB'}
          </Text>
        </View>
        {cardInfo?.atr && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ATR:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {cardInfo.atr.substring(0, 20)}...
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
        <Text style={styles.completeButtonText}>Terminer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContainer}>
      <View style={styles.errorIcon}>
        <Ionicons name="close-circle" size={100} color={COLORS.danger} />
      </View>
      <Text style={styles.errorTitle}>ERREUR</Text>
      <Text style={styles.errorMessage}>{error}</Text>

      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Réessayer</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 'select_mode':
        return renderModeSelection();
      case 'scanning':
        return renderScanning();
      case 'select_reader':
        return renderReaderSelection();
      case 'connecting':
        return renderConnecting();
      case 'waiting_card':
        return renderWaitingCard();
      case 'detecting_card':
        return renderDetectingCard();
      case 'card_rejected':
        return renderCardRejected();
      case 'reading_card':
        return renderReadingCard();
      case 'processing':
        return renderProcessing();
      case 'success':
        return renderSuccess();
      case 'error':
        return renderError();
      default:
        return renderModeSelection();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement Carte</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Montant */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Montant à payer</Text>
        <Text style={styles.amountValue}>
          {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
        </Text>
      </View>

      {/* Indicateur de connexion */}
      {connectionMode !== 'select' && (
        <View style={styles.connectionIndicator}>
          <Ionicons 
            name={connectionMode === 'bluetooth' ? 'bluetooth' : 'hardware-chip'} 
            size={16} 
            color={COLORS.primary} 
          />
          <Text style={styles.connectionText}>
            {connectionMode === 'bluetooth' ? 'Bluetooth BLE' : 'USB-C'}
          </Text>
        </View>
      )}

      {/* Contenu principal */}
      <ScrollView style={styles.content}>
        {error && step !== 'error' && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
        
        {renderContent()}
      </ScrollView>
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
  amountCard: {
    backgroundColor: COLORS.secondary,
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center'
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
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  connectionText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  errorBannerText: {
    color: COLORS.danger,
    marginLeft: 8,
    flex: 1
  },

  // Mode Selection
  modeContainer: {
    flex: 1
  },
  modeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: 8
  },
  modeSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24
  },
  webWarning: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24
  },
  webWarningText: {
    flex: 1,
    marginLeft: 12,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18
  },
  modeButton: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  modeInfo: {
    flex: 1
  },
  modeButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark
  },
  modeButtonDesc: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4
  },

  // Center Container
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  scanningTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 20
  },
  scanningSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center'
  },
  cancelScanButton: {
    marginTop: 24,
    padding: 12
  },
  cancelScanText: {
    color: COLORS.danger,
    fontSize: 16
  },

  // Reader List
  listContainer: {
    flex: 1
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  readersList: {
    flex: 1
  },
  readerCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  readerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  readerInfo: {
    flex: 1
  },
  readerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark
  },
  readerType: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  rescanText: {
    color: COLORS.primary,
    marginLeft: 8,
    fontSize: 16
  },

  // Connecting
  connectingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 20
  },
  connectingSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8
  },

  // Waiting Card
  cardIconContainer: {
    marginBottom: 24
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 8
  },
  waitingSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24
  },
  readerStatusCard: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  readerStatusText: {
    color: COLORS.success,
    marginLeft: 8,
    fontWeight: '600'
  },
  manualButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  manualButtonText: {
    color: COLORS.white,
    fontWeight: '600'
  },

  // Reading
  readingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 20
  },
  atrText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  cardTypeInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: COLORS.light,
    borderRadius: 8
  },
  cardTypeText: {
    fontSize: 12,
    color: COLORS.secondary
  },

  // Detecting
  detectingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 20
  },
  detectingSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8
  },

  // Card Rejected
  rejectedIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  rejectedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8
  },
  rejectedSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  rejectedMessageBox: {
    backgroundColor: COLORS.light,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16
  },
  rejectedMessage: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20
  },
  atrContainer: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  atrLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4
  },
  atrValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.dark
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 16
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.danger,
    lineHeight: 18
  },
  expectedCardInfo: {
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24
  },
  expectedCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8
  },
  expectedCardText: {
    fontSize: 13,
    color: COLORS.secondary,
    marginBottom: 4
  },

  // Processing
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 20
  },
  processingAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.warning,
    marginTop: 8
  },

  // Success
  successIcon: {
    marginBottom: 16
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: 8
  },
  successAmount: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 24
  },
  successDetails: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  detailLabel: {
    color: COLORS.gray,
    fontSize: 14
  },
  detailValue: {
    color: COLORS.dark,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%'
  },
  completeButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%'
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },

  // Error
  errorIcon: {
    marginBottom: 16
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 8
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
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
    paddingHorizontal: 48,
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
  }
});
