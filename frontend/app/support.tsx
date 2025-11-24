import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';

export default function SupportScreen() {
  const router = useRouter();

  const faqData = [
    {
      question: 'Comment configurer mon wallet marchand ?',
      answer: 'Allez dans Paramètres > Compte Marchand et entrez votre adresse Metamask pour recevoir les paiements.'
    },
    {
      question: 'Quelles cryptomonnaies sont supportées ?',
      answer: 'L\'application supporte actuellement XAF Stable, EUROM Stable et TND Stable sur le réseau BSC Testnet.'
    },
    {
      question: 'Comment fonctionne le paiement par lien ?',
      answer: 'Générez un QR code ou un lien que le client scanne avec Metamask pour payer directement depuis son wallet.'
    },
    {
      question: 'Quand les paiements par carte seront disponibles ?',
      answer: 'Les paiements par carte (NFC, USB, Bluetooth) sont en cours de développement et seront disponibles prochainement.'
    },
    {
      question: 'Comment effectuer un remboursement ?',
      answer: 'Allez dans Remboursements, entrez l\'ID de la transaction et la raison. Le remboursement nécessite une validation manuelle.'
    },
    {
      question: 'Les transactions sont-elles sécurisées ?',
      answer: 'Oui, toutes les transactions utilisent la blockchain BSC avec cryptographie et sont vérifiables publiquement.'
    }
  ];

  const contactOptions = [
    {
      icon: 'mail',
      title: 'Email',
      subtitle: 'support@tpecrypto.com',
      action: () => Linking.openURL('mailto:support@tpecrypto.com')
    },
    {
      icon: 'chatbubbles',
      title: 'Chat Support',
      subtitle: 'Chat en direct (bientôt)',
      action: () => {}
    },
    {
      icon: 'call',
      title: 'Téléphone',
      subtitle: '+33 X XX XX XX XX',
      action: () => {}
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & Assistance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Help */}
        <View style={styles.section}>
          <View style={styles.welcomeCard}>
            <Ionicons name="help-circle" size={48} color={COLORS.primary} />
            <Text style={styles.welcomeTitle}>Comment pouvons-nous vous aider ?</Text>
            <Text style={styles.welcomeText}>
              Consultez notre FAQ ou contactez notre équipe support
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions Fréquentes</Text>
          {faqData.map((faq, index) => (
            <View key={index} style={styles.faqCard}>
              <View style={styles.faqHeader}>
                <Ionicons name="help-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.faqQuestion}>{faq.question}</Text>
              </View>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nous Contacter</Text>
          {contactOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.contactCard}
              onPress={option.action}
            >
              <View style={styles.contactIcon}>
                <Ionicons name={option.icon as any} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>{option.title}</Text>
                <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ressources</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.resourceRow}>
              <Ionicons name="book" size={20} color={COLORS.gray} />
              <Text style={styles.resourceText}>Guide d'utilisation</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceRow}>
              <Ionicons name="document-text" size={20} color={COLORS.gray} />
              <Text style={styles.resourceText}>Documentation API</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceRow}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.gray} />
              <Text style={styles.resourceText}>Politique de confidentialité</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.appInfoCard}>
            <Text style={styles.appInfoTitle}>TPE Crypto</Text>
            <Text style={styles.appInfoVersion}>Version 1.0.0 (Beta)</Text>
            <Text style={styles.appInfoText}>
              Application de paiement blockchain pour commerçants
            </Text>
            <Text style={styles.appInfoCopyright}>
              © 2025 TPE Crypto. Tous droits réservés.
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
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  welcomeCard: {
    backgroundColor: COLORS.white,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center'
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginTop: 16,
    textAlign: 'center'
  },
  welcomeText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center'
  },
  faqCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginLeft: 12
  },
  faqAnswer: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginLeft: 32
  },
  contactCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  contactInfo: {
    flex: 1
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark
  },
  contactSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden'
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  resourceText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 12
  },
  appInfoCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center'
  },
  appInfoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  appInfoVersion: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4
  },
  appInfoText: {
    fontSize: 14,
    color: COLORS.dark,
    textAlign: 'center',
    marginTop: 12
  },
  appInfoCopyright: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 16
  }
});
