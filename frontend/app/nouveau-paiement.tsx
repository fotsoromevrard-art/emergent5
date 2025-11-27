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
import { COLORS, CURRENCY_NAMES } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';

const CURRENCIES = [
  { key: 'XAF_STABLE', label: 'XAF Stable', icon: 'cash' },
  { key: 'EUROM_STABLE', label: 'EUROM Stable', icon: 'cash' },
  { key: 'TND_STABLE', label: 'TND Stable', icon: 'cash' }
];

const PAYMENT_METHODS = [
  { 
    key: 'card_contact', 
    label: 'Carte à puce (contact)', 
    icon: 'card',
    available: true,
    message: 'Mode simulation'
  },
  { 
    key: 'card_usb', 
    label: 'Carte via câble USB-C', 
    icon: 'hardware-chip',
    available: true,
    message: 'Mode simulation'
  },
  { 
    key: 'card_bluetooth', 
    label: 'Carte via Bluetooth', 
    icon: 'bluetooth',
    available: true,
    message: 'Mode simulation'
  },
  { 
    key: 'crypto_link', 
    label: 'Paiement par lien (Metamask)', 
    icon: 'link',
    available: true,
    message: ''
  }
];

export default function NouveauPaiementScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'currency' | 'amount' | 'method'>('currency');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');

  const handleCurrencySelect = (currency: string) => {
    setSelectedCurrency(currency);
    setStep('amount');
  };

  const handleAmountNext = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    setStep('method');
  };

  const handleMethodSelect = (method: string) => {
    const paymentMethod = PAYMENT_METHODS.find(m => m.key === method);
    
    setSelectedMethod(method);
    
    // Redirect to appropriate payment screen
    if (method === 'crypto_link') {
      if (!paymentMethod?.available) {
        Alert.alert('Non disponible', paymentMethod?.message || 'Cette méthode n\'est pas encore disponible');
        return;
      }
      router.push({
        pathname: '/paiement-lien',
        params: {
          currency: selectedCurrency,
          amount: amount
        }
      });
    } else {
      // Card payment screen - JCOP
      router.push({
        pathname: '/paiement-carte-jcop',
        params: {
          currency: selectedCurrency,
          amount: amount,
          method: method
        }
      });
    }
  };

  const handleBack = () => {
    if (step === 'currency') {
      router.back();
    } else if (step === 'amount') {
      setStep('currency');
    } else {
      setStep('amount');
    }
  };

  const addToAmount = (value: string) => {
    if (value === 'clear') {
      setAmount('');
    } else if (value === 'backspace') {
      setAmount(amount.slice(0, -1));
    } else {
      if (value === '.' && amount.includes('.')) return;
      setAmount(amount + value);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressDot, step !== 'currency' && styles.progressDotActive]} />
        <View style={styles.progressLine} />
        <View style={[styles.progressDot, step === 'method' && styles.progressDotActive]} />
        <View style={styles.progressLine} />
        <View style={[styles.progressDot, selectedMethod && styles.progressDotActive]} />
      </View>

      <ScrollView style={styles.content}>
        {/* Step 1: Currency Selection */}
        {step === 'currency' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choisir la devise</Text>
            {CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.key}
                style={styles.optionCard}
                onPress={() => handleCurrencySelect(currency.key)}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={currency.icon as any} size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.optionLabel}>{currency.label}</Text>
                <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Amount Entry */}
        {step === 'amount' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Entrer le montant</Text>
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyBadgeText}>{CURRENCY_NAMES[selectedCurrency as keyof typeof CURRENCY_NAMES]}</Text>
            </View>
            
            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>{amount || '0'}</Text>
            </View>

            {/* Numeric Keypad */}
            <View style={styles.keypad}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'backspace']].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.keypadButton}
                      onPress={() => addToAmount(key)}
                    >
                      {key === 'backspace' ? (
                        <Ionicons name="backspace-outline" size={24} color={COLORS.dark} />
                      ) : (
                        <Text style={styles.keypadText}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.clearButton]}
                onPress={() => addToAmount('clear')}
              >
                <Text style={styles.clearButtonText}>Effacer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.nextButton]}
                onPress={handleAmountNext}
              >
                <Text style={styles.nextButtonText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Payment Method */}
        {step === 'method' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Moyen de paiement</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Montant</Text>
              <Text style={styles.summaryAmount}>{amount} {CURRENCY_NAMES[selectedCurrency as keyof typeof CURRENCY_NAMES]}</Text>
            </View>
            
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.optionCard,
                  !method.available && styles.optionCardDisabled
                ]}
                onPress={() => handleMethodSelect(method.key)}
              >
                <View style={[
                  styles.optionIcon,
                  !method.available && styles.optionIconDisabled
                ]}>
                  <Ionicons 
                    name={method.icon as any} 
                    size={28} 
                    color={method.available ? COLORS.primary : COLORS.gray} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.optionLabel,
                    !method.available && styles.optionLabelDisabled
                  ]}>
                    {method.label}
                  </Text>
                  {!method.available && (
                    <Text style={styles.optionSubtext}>{method.message}</Text>
                  )}
                </View>
                {method.available && (
                  <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
                )}
              </TouchableOpacity>
            ))}
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.white
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border
  },
  progressDotActive: {
    backgroundColor: COLORS.success
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border
  },
  content: {
    flex: 1
  },
  stepContainer: {
    padding: 20
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 24
  },
  optionCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  optionCardDisabled: {
    opacity: 0.6
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  optionIconDisabled: {
    backgroundColor: '#f0f0f0'
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark
  },
  optionLabelDisabled: {
    color: COLORS.gray
  },
  optionSubtext: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4
  },
  currencyBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20
  },
  currencyBadgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600'
  },
  amountDisplay: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary
  },
  amountText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  keypad: {
    marginBottom: 20
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.dark
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  clearButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.danger
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger
  },
  nextButton: {
    backgroundColor: COLORS.success
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white
  },
  summaryCard: {
    backgroundColor: COLORS.secondary,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 8
  }
});
