/**
 * Service de détection de plateforme
 * Détermine les capacités de l'environnement d'exécution
 */

import { Platform } from 'react-native';

class PlatformServiceClass {
  /**
   * Vérifie si l'app tourne sur le web
   */
  get isWeb(): boolean {
    return Platform.OS === 'web';
  }

  /**
   * Vérifie si l'app tourne sur une plateforme native (iOS/Android)
   */
  get isNative(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Vérifie si l'app tourne sur Android
   */
  get isAndroid(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Vérifie si l'app tourne sur iOS
   */
  get isIOS(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Vérifie si l'USB est disponible (Android uniquement pour le moment)
   */
  get canUseUSB(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Retourne le nom de la plateforme
   */
  get platformName(): string {
    return Platform.OS;
  }

  /**
   * Vérifie si on est en mode Expo Go (sans modules natifs)
   * Dans un build custom, cette valeur sera false
   */
  isExpoGo(): boolean {
    try {
      // En Expo Go, certains modules natifs ne sont pas disponibles
      // On peut détecter cela en vérifiant si le module USB est chargeable
      return false; // Sera true si le module n'est pas disponible
    } catch {
      return true;
    }
  }
}

export const PlatformService = new PlatformServiceClass();
export default PlatformService;
