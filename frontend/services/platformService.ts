/**
 * Platform Service - Détection de plateforme et gestion des capacités
 * Empêche l'exécution du code natif sur le web
 */

import { Platform } from 'react-native';

export const PlatformService = {
  // Vérifie si on est sur une plateforme native (Android/iOS)
  isNative: Platform.OS === 'android' || Platform.OS === 'ios',
  
  // Vérifie si on est sur Android
  isAndroid: Platform.OS === 'android',
  
  // Vérifie si on est sur iOS
  isIOS: Platform.OS === 'ios',
  
  // Vérifie si on est sur le web
  isWeb: Platform.OS === 'web',
  
  // Vérifie si Bluetooth est disponible (uniquement sur native)
  canUseBluetooth: Platform.OS === 'android' || Platform.OS === 'ios',
  
  // Vérifie si USB est disponible (uniquement sur Android)
  canUseUSB: Platform.OS === 'android',
  
  // Message d'erreur pour les fonctionnalités non disponibles
  getUnavailableMessage: (feature: string): string => {
    if (Platform.OS === 'web') {
      return `${feature} n'est pas disponible dans le navigateur. Utilisez l'application mobile.`;
    }
    return `${feature} n'est pas disponible sur cette plateforme.`;
  }
};

export default PlatformService;
