# 🚀 TPE Crypto - Guide d'Accès à l'Application

## ✅ SOLUTION AU PROBLÈME "ERREUR JAVA.IO EXCEPTION"

Cette erreur se produit parfois lors du téléchargement via Expo Go. Voici les **solutions alternatives** qui fonctionnent :

---

## 🌐 MÉTHODE 1 : Accès Web (RECOMMANDÉ) ⭐

**La plus simple et la plus fiable**

### Étapes :

1. **Ouvrir votre navigateur** (Chrome, Firefox, Safari, Edge)

2. **Aller à l'URL** :
   ```
   https://smart-pay-point.preview.emergentagent.com
   ```

3. **L'application se charge directement** dans le navigateur

### Avantages :
✅ Pas d'installation nécessaire  
✅ Fonctionne sur mobile ET ordinateur  
✅ Pas de problème de téléchargement  
✅ Mise à jour instantanée  

### Sur Mobile :
- Ouvrir le navigateur de votre téléphone
- Entrer l'URL ci-dessus
- Vous pouvez aussi "Ajouter à l'écran d'accueil" pour créer un raccourci comme une vraie app

---

## 📱 MÉTHODE 2 : Expo Go (Alternative)

Si vous souhaitez absolument utiliser Expo Go :

### Solution A : Connexion LAN (WiFi local)

1. **Vérifier** que votre téléphone et l'ordinateur sont sur le **même réseau WiFi**

2. **Ouvrir Expo Go**

3. **Scanner le QR code** qui s'affiche dans les logs

4. **Si erreur Java IO** : Attendre 30 secondes et réessayer

### Solution B : Redémarrer proprement

```bash
# Sur le serveur
cd /app/frontend
rm -rf .expo node_modules/.cache
sudo supervisorctl restart expo
```

Attendre 30 secondes puis rescanner le QR code.

---

## 🔧 MÉTHODE 3 : Test du Backend Direct

Pour tester uniquement l'API backend (sans interface) :

```bash
# Test de connexion
curl http://localhost:8001/api/

# Test blockchain
curl http://localhost:8001/api/blockchain/status

# Test tokens supportés
curl http://localhost:8001/api/tokens/supported
```

---

## 📋 Vérification que tout fonctionne

### 1. Backend API
```bash
curl http://localhost:8001/api/blockchain/status
```

**Résultat attendu** :
```json
{
  "connected": true,
  "chain_id": 97,
  "latest_block": 74XXXXXX,
  "gas_price_gwei": 0.1
}
```

### 2. Frontend Web
Ouvrir : `https://smart-pay-point.preview.emergentagent.com`

**Résultat attendu** :
- Page de l'application TPE Crypto qui se charge
- Demande de configuration du wallet Metamask

---

## 🐛 Résolution des Problèmes Courants

### Erreur "Cannot connect to Metro"
**Solution** : Utiliser l'URL web preview (Méthode 1)

### Erreur "Java IO Exception"
**Solution** : 
1. Utiliser l'URL web preview (Méthode 1)
2. OU vérifier que vous êtes sur le même WiFi
3. OU redémarrer l'app après 30 secondes

### Page blanche dans le navigateur
**Solution** :
```bash
sudo supervisorctl restart expo
# Attendre 30 secondes
```

### QR code ne fonctionne pas
**Solution** : Entrer manuellement l'URL dans Expo Go :
```
exp://paychain-app-1.preview.emergentagent.com
```

---

## 📞 Support

Si vous rencontrez toujours des problèmes :

1. **Vérifier les services** :
   ```bash
   sudo supervisorctl status
   ```
   
2. **Consulter les logs** :
   ```bash
   tail -50 /var/log/supervisor/expo.err.log
   tail -50 /var/log/supervisor/backend.err.log
   ```

3. **Redémarrer tous les services** :
   ```bash
   sudo supervisorctl restart all
   ```

---

## ✨ Recommandation Finale

**Pour la meilleure expérience**, utilisez la **Méthode 1 (Accès Web)** :

```
🔗 https://smart-pay-point.preview.emergentagent.com
```

Cette méthode :
- ✅ Fonctionne toujours
- ✅ Pas de problème de téléchargement
- ✅ Accès immédiat
- ✅ Compatible tous appareils

---

## 🎯 Première Utilisation

Une fois l'application ouverte (via web ou Expo Go) :

1. **Configuration Wallet** :
   - Un modal s'affiche automatiquement
   - Entrer votre adresse Metamask (BSC Testnet)
   - Format : `0x...` (42 caractères)
   - Exemple : `0x742D5Cc6bF2442E8C7c74c7b4Be6AB9d6f10f5B4`

2. **Tester l'application** :
   - Consulter vos soldes
   - Créer un nouveau paiement
   - Voir l'historique des transactions

---

**L'application est fonctionnelle et accessible ! 🚀**
