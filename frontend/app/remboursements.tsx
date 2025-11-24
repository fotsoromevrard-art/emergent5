import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import { processRefund } from '../services/api';

export default function RemboursementsScreen() {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitRefund = async () => {
    if (!transactionId || !reason) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs requis');
      return;
    }

    Alert.alert(
      'Confirmer le remboursement',
      `Êtes-vous sûr de vouloir effectuer ce remboursement ?${amount ? `\nMontant: ${amount}` : '\nMontant: Total'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await processRefund({
                transaction_id: transactionId,
                amount: amount ? parseFloat(amount) : undefined,
                reason: reason
              });
              Alert.alert(
                'Succès',
                'Demande de remboursement créée avec succès. Un traitement manuel est requis.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de créer la demande de remboursement');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Remboursements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={32} color={COLORS.warning} />
          <Text style={styles.warningText}>
            Les remboursements nécessitent une vérification manuelle et peuvent prendre du temps
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ID Transaction *</Text>
            <TextInput
              style={styles.input}
              placeholder="ID de la transaction à rembourser"
              value={transactionId}
              onChangeText={setTransactionId}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Montant (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Laisser vide pour remboursement total"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>
              Si vide, le montant total de la transaction sera remboursé
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Raison du remboursement *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Expliquez la raison du remboursement"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmitRefund}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Traitement...' : 'Demander le remboursement'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Processus de remboursement</Text>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.infoText}>
              Soumettre la demande de remboursement avec l'ID de transaction
            </Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.infoText}>
              Vérification manuelle de la transaction
            </Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.infoText}>
              Initiation du remboursement (carte ou crypto)
            </Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.infoText}>
              Confirmation et notification
            </Text>
          </View>
        </View>
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
    flex: 1,
    padding: 16
  },
  warningCard: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    marginLeft: 12
  },
  form: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20
  },
  inputGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: COLORS.white
  },
  textArea: {
    minHeight: 100
  },
  hint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4
  },
  submitButton: {
    backgroundColor: COLORS.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  },
  infoCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 16
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  stepNumberText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600'
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dark,
    lineHeight: 20
  }
});
