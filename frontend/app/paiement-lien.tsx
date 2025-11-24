import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useWallet } from '../context/WalletContext';
import { createPaymentLink, getTransactionStatus } from '../services/api';

type PaymentStatus = 'creating' | 'pending' | 'processing' | 'confirmed' | 'failed';

export default function PaiementLienScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { merchantAddress } = useWallet();
  
  const [status, setStatus] = useState<PaymentStatus>('creating');
  const [paymentId, setPaymentId] = useState('');
  const [qrData, setQrData] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [txHash, setTxHash] = useState('');

  const currency = params.currency as string;
  const amount = parseFloat(params.amount as string);

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      if (!merchantAddress) {
        Alert.alert('Erreur', 'Wallet marchand non configuré');
        router.back();
        return;
      }

      const response = await createPaymentLink({
        amount: amount,
        currency: currency,
        recipient_address: merchantAddress,
        description: `Paiement ${CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}`
      });

      setPaymentId(response.payment_id);
      setQrData(response.qr_data);
      setPaymentLink(response.payment_link);
      setStatus('pending');
    } catch (error) {
      console.error('Error creating payment link:', error);
      Alert.alert('Erreur', 'Impossible de créer le lien de paiement');
      router.back();
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Paiement de ${amount} ${CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}\n\nLien: ${paymentLink}\n\nScannez le QR code ou utilisez le lien pour payer via Metamask`,
        title: 'Demande de paiement'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler le paiement',
      'Êtes-vous sûr de vouloir annuler cette demande de paiement ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, annuler', 
          style: 'destructive',
          onPress: () => router.back()
        }
      ]
    );
  };

  const getStatusColor = () => {
    switch (status) {
      case 'confirmed': return COLORS.success;
      case 'failed': return COLORS.danger;
      case 'processing': return COLORS.warning;
      default: return COLORS.secondary;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'processing': return 'hourglass';
      default: return 'time';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'creating': return 'Génération du lien de paiement...';
      case 'pending': return 'En attente du paiement client';
      case 'processing': return 'Transaction en cours de traitement...';
      case 'confirmed': return 'Paiement confirmé !';
      case 'failed': return 'Échec du paiement';
      default: return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement par Lien</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Ionicons name={getStatusIcon() as any} size={32} color={COLORS.white} />
          <Text style={styles.statusText}>{getStatusMessage()}</Text>
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant à payer</Text>
          <Text style={styles.amountValue}>
            {amount} {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}
          </Text>
        </View>

        {status === 'pending' && (
          <>
            {/* QR Code */}
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>Scannez avec Metamask</Text>
              <View style={styles.qrCodeWrapper}>
                {qrData ? (
                  <QRCode
                    value={qrData}
                    size={220}
                    backgroundColor={COLORS.white}
                  />
                ) : (
                  <ActivityIndicator size="large" color={COLORS.primary} />
                )}
              </View>
              <Text style={styles.qrSubtext}>
                Le client doit scanner ce QR code avec son application Metamask
              </Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Instructions pour le client :</Text>
              <View style={styles.instruction}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Ouvrir l'application Metamask
                </Text>
              </View>
              <View style={styles.instruction}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Scanner le QR code ou utiliser le lien
                </Text>
              </View>
              <View style={styles.instruction}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Confirmer le montant et signer la transaction
                </Text>
              </View>
              <View style={styles.instruction}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>4</Text>
                </View>
                <Text style={styles.instructionText}>
                  Attendre la confirmation blockchain
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social" size={24} color={COLORS.white} />
              <Text style={styles.shareButtonText}>Partager le lien</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'confirmed' && (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
            <Text style={styles.successTitle}>Paiement réussi !</Text>
            {txHash && (
              <View style={styles.txHashCard}>
                <Text style={styles.txHashLabel}>Transaction Hash:</Text>
                <Text style={styles.txHashValue} numberOfLines={1}>
                  {txHash}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.doneButtonText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'failed' && (
          <View style={styles.failureContainer}>
            <Ionicons name="close-circle" size={100} color={COLORS.danger} />
            <Text style={styles.failureTitle}>Paiement échoué</Text>
            <Text style={styles.failureText}>
              La transaction n'a pas pu être complétée. Veuillez réessayer.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment Details */}
        {paymentId && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Détails du paiement</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID Paiement:</Text>
              <Text style={styles.detailValue}>{paymentId.slice(0, 8)}...</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Devise:</Text>
              <Text style={styles.detailValue}>
                {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES]}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant:</Text>
              <Text style={styles.detailValue}>{amount}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destinataire:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {merchantAddress?.slice(0, 10)}...
              </Text>
            </View>
          </View>
        )}
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
  content: {
    padding: 20
  },
  statusBadge: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  statusText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8
  },
  amountCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.primary
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  qrContainer: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16
  },
  qrSubtext: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center'
  },
  instructionsCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20
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
  },
  shareButton: {
    backgroundColor: COLORS.secondary,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20
  },
  cancelButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600'
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 20,
    marginBottom: 20
  },
  txHashCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20
  },
  txHashLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4
  },
  txHashValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    fontFamily: 'monospace'
  },
  doneButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  },
  failureContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  failureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginTop: 20,
    marginBottom: 12
  },
  failureText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  },
  detailsCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.gray
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    flex: 1,
    textAlign: 'right'
  }
});
