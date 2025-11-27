import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import jcopCardService, { CardReader, WalletInfo } from '../services/jcopCardService';

type PaymentStep = 'select_reader' | 'connecting' | 'waiting_card' | 'reading_card' | 'processing' | 'checking_balance' | 'success' | 'declined';

export default function PaiementCarteJCOPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [step, setStep] = useState<PaymentStep>('select_reader');
  const [readers, setReaders] = useState<CardReader[]>([]);
  const [selectedReader, setSelectedReader] = useState<CardReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string>('');

  const currency = params.currency as string;
  const amount = parseFloat(params.amount as string);
  const paymentMethod = params.method as string;

  useEffect(() => {
    // Scanner automatiquement au démarrage
    handleScanReaders();
  }, []);

  // Scanner les lecteurs disponibles
  const handleScanReaders = async () => {
    try {
      setScanning(true);
      setError('');
      
      // Demander les permissions
      const hasPermissions = await jcopCardService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions requises', 'Les permissions Bluetooth sont nécessaires pour scanner les lecteurs');
        return;
      }

      // Scanner pendant 10 secondes
      const foundReaders = await jcopCardService.scanForReaders(10000);
      
      if (foundReaders.length === 0) {
        setError('Aucun lecteur trouvé. Vérifiez que votre lecteur est allumé et à proximité.');
      } else {
        setReaders(foundReaders);
      }
    } catch (err) {
      console.error('Erreur scan:', err);
      setError('Erreur lors du scan des lecteurs');
    } finally {
      setScanning(false);
    }
  };

  // Sélectionner et connecter un lecteur
  const handleSelectReader = async (reader: CardReader) => {
    try {
      setStep('connecting');
      setSelectedReader(reader);
      setError('');

      const connected = await jcopCardService.connectToReader(reader);
      
      if (connected) {
        setStep('waiting_card');
      } else {
        setError('Échec de la connexion au lecteur');
        setStep('select_reader');
      }
    } catch (err) {
      console.error('Erreur connexion:', err);
      setError('Impossible de se connecter au lecteur');
      setStep('select_reader');
    }
  };

  // Traiter le paiement avec la carte JCOP
  const handleProcessPayment = async () => {
    try {
      setStep('reading_card');
      setError('');

      // Attendre un peu pour simuler l'insertion
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStep('processing');
      
      // Lecture de l'adresse et du solde
      await new Promise(resolve => setTimeout(resolve, 1500));

      setStep('checking_balance');

      // Processus complet de paiement via JCOP
      const result = await jcopCardService.processPayment(amount, currency);

      if (result) {
        setWalletInfo(result);
        setStep('success');
      } else {
        setError('Échec du paiement');
        setStep('declined');
      }
    } catch (err: any) {
      console.error('Erreur paiement:', err);
      setError(err.message || 'Erreur lors du paiement');
      setStep('declined');
    }
  };

  const handleRetry = () => {
    setStep('waiting_card');
    setWalletInfo(null);
    setError('');
  };

  const handleComplete = async () => {
    await jcopCardService.disconnect();
    router.push('/');
  };

  const handleCancel = async () => {
    await jcopCardService.disconnect();
    router.back();
  };

  const getMethodIcon = () => {
    switch (paymentMethod) {
      case 'card_usb': return 'hardware-chip';
      case 'card_bluetooth': return 'bluetooth';
      default: return 'card';
    }
  };

  const getMethodLabel = () => {
    switch (paymentMethod) {
      case 'card_usb': return 'Carte via câble USB-C';
      case 'card_bluetooth': return 'Carte via Bluetooth';
      default: return 'Carte à puce';
    }
  };

  // Rendu de la liste des lecteurs
  const renderReaderItem = ({ item }: { item: CardReader }) => (
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
          {item.type === 'bluetooth' ? 'Bluetooth' : 'USB'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement JCOP</Text>
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

        {/* Méthode */}
        <View style={styles.methodCard}>
          <Ionicons name={getMethodIcon() as any} size={32} color={COLORS.primary} />
          <Text style={styles.methodText}>{getMethodLabel()}</Text>
        </View>

        {/* Étape 1: Sélection du lecteur */}
        {step === 'select_reader' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Sélectionner un lecteur</Text>
            
            {scanning && (
              <View style={styles.scanningContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.scanningText}>Recherche de lecteurs...</Text>
              </View>
            )}

            {!scanning && readers.length > 0 && (
              <FlatList
                data={readers}
                renderItem={renderReaderItem}
                keyExtractor={item => item.id}
                style={styles.readersList}
              />
            )}

            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScanReaders}
              disabled={scanning}
            >
              <Ionicons name="refresh" size={20} color={COLORS.white} />
              <Text style={styles.scanButtonText}>
                {scanning ? 'Scan en cours...' : 'Re-scanner'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 2: Connexion */}
        {step === 'connecting' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Connexion au lecteur...</Text>
            <Text style={styles.stepDescription}>
              {selectedReader?.name}
            </Text>
          </View>
        )}

        {/* Étape 3: Attente carte */}
        {step === 'waiting_card' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="card-outline" size={80} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Insérer la carte JCOP</Text>
            <Text style={styles.stepDescription}>
              Insérez votre carte à puce dans le lecteur
            </Text>
            
            <View style={styles.readerInfoCard}>
              <Text style={styles.readerInfoLabel}>Lecteur connecté :</Text>
              <Text style={styles.readerInfoValue}>{selectedReader?.name}</Text>
            </View>

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleProcessPayment}
            >
              <Text style={styles.actionButtonText}>Carte insérée</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 4: Lecture carte */}
        {step === 'reading_card' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stepTitle}>Lecture de la carte JCOP...</Text>
            <Text style={styles.stepDescription}>
              Communication avec la carte
            </Text>
          </View>
        )}

        {/* Étape 5: Processing */}
        {step === 'processing' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.warning} />
            <Text style={styles.stepTitle}>Lecture du wallet</Text>
            <Text style={styles.stepDescription}>
              Commandes APDU en cours...
            </Text>
          </View>
        )}

        {/* Étape 6: Vérification */}
        {step === 'checking_balance' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.stepTitle}>Vérification et débit</Text>
            <Text style={styles.stepDescription}>
              Signature de la transaction...
            </Text>
          </View>
        )}

        {/* Étape 7a: Succès */}
        {step === 'success' && walletInfo && (
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
                <Text style={styles.resultValue}>
                  {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Wallet :</Text>
                <Text style={styles.resultValue} numberOfLines={1}>
                  {walletInfo.address.slice(0, 10)}...{walletInfo.address.slice(-6)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Nouveau solde :</Text>
                <Text style={styles.resultValue}>{walletInfo.balance.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
              <Text style={styles.completeButtonText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 7b: Échec */}
        {step === 'declined' && (
          <View style={styles.stepContainer}>
            <View style={styles.declinedIcon}>
              <Ionicons name="close-circle" size={100} color={COLORS.danger} />
            </View>
            <Text style={styles.declinedTitle}>REFUSÉ</Text>
            <Text style={styles.declinedDescription}>
              {error || 'Paiement refusé'}
            </Text>

            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
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
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  scanningText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16
  },
  readersList: {
    width: '100%',
    marginBottom: 20
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
  errorCard: {
    backgroundColor: '#FEE2E2',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
    width: '100%'
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: 12,
    textAlign: 'center'
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  iconContainer: {
    marginBottom: 24
  },
  readerInfoCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  readerInfoLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4
  },
  readerInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark
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
    color: COLORS.dark,
    maxWidth: '60%'
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
  }
});
