/**
 * Service de détection de plateforme
 * Détermine si l'application fonctionne sur web, native, etc.
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
   * Mode de démonstration (toujours vrai pour Expo Go)
   * En production avec un build custom, ceci sera false
   */
  get isDemoMode(): boolean {
    // Pour Expo Go, on est toujours en mode démo
    // Un vrai build natif aurait accès aux modules natifs
    return true;
  }

  /**
   * Retourne le nom de la plateforme
   */
  get platformName(): string {
    return Platform.OS;
  }
}

export const PlatformService = new PlatformServiceClass();
export default PlatformService;
