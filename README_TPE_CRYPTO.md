# 📱 TPE Crypto - Application de Paiement Blockchain

## 🎯 Vue d'ensemble

TPE Crypto est une application mobile de terminal de paiement électronique (TPE) moderne qui combine les paiements blockchain avec les fonctionnalités traditionnelles de carte bancaire. L'application permet aux commerçants d'accepter des paiements en cryptomonnaies via Metamask et prépare l'intégration future des paiements par carte à puce.

### ✨ Fonctionnalités Principales

#### ✅ Implémentées (Phase 1)
- **Paiements Crypto via Metamask** : Génération de liens de paiement avec QR code
- **3 Tokens supportés** : XAF Stable, EUROM Stable, TND Stable (BSC Testnet)
- **Gestion du wallet marchand** : Configuration et suivi du wallet Metamask
- **Suivi des transactions** : Historique complet avec filtres
- **Remboursements** : Système de demande de remboursement
- **Dashboard** : Vue d'ensemble des soldes et activités
- **Paramètres** : Configuration complète de l'application
- **Support** : FAQ et assistance

#### 🔜 En développement (Phase 2)
- **Paiement par carte à puce (contact NFC)**
- **Paiement par carte via câble USB-C**
- **Paiement par carte via Bluetooth**
- **Lecteur de carte physique**
- **Authentification PIN/Biométrique**

---

## 🏗️ Architecture

### Stack Technologique

#### Frontend (Mobile)
- **Framework** : Expo / React Native
- **Navigation** : Expo Router (file-based routing)
- **State Management** : React Context API
- **Blockchain** : web3.js, ethers.js
- **UI Components** : React Native native components
- **QR Code** : react-native-qrcode-svg

#### Backend (API)
- **Framework** : FastAPI (Python)
- **Blockchain** : web3.py
- **Database** : MongoDB (Motor async driver)
- **Network** : BSC Testnet (Binance Smart Chain)

#### Blockchain
- **Network** : BSC Testnet (Chain ID: 97)
- **RPC** : https://data-seed-prebsc-1-s1.binance.org:8545
- **Standard** : ERC-20 Tokens

### Tokens Configurés

| Token | Symbole | Adresse de Contrat (BSC Testnet) |
|-------|---------|-----------------------------------|
| XAF Stable | XAF_STABLE | 0x3c96aBa8bA994Cb2452a9BcE362Efb0EDCDfaEee |
| EUROM Stable | EUROM_STABLE | 0x531B876fc439F64Be5922551FE222aBf08B8D08E |
| TND Stable | TND_STABLE | 0x6ae8193d14fb289E43AD1238aadEB1E537EdCa6B |

---

## 📂 Structure du Projet

```
/app
├── backend/
│   ├── server.py          # API FastAPI principale
│   ├── .env              # Configuration environnement
│   └── requirements.txt  # Dépendances Python
│
└── frontend/
    ├── app/              # Écrans de l'application (Expo Router)
    │   ├── _layout.tsx           # Layout racine
    │   ├── index.tsx             # Écran d'accueil
    │   ├── nouveau-paiement.tsx  # Nouvelle transaction
    │   ├── paiement-lien.tsx     # Paiement crypto
    │   ├── transactions.tsx      # Historique
    │   ├── remboursements.tsx    # Gestion remboursements
    │   ├── parametres.tsx        # Configuration
    │   └── support.tsx           # Support & FAQ
    │
    ├── config/
    │   └── constants.ts          # Configuration globale
    │
    ├── context/
    │   └── WalletContext.tsx     # State management wallet
    │
    ├── services/
    │   └── api.ts               # Appels API backend
    │
    └── package.json
```

---

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- Python 3.11+
- MongoDB
- Expo CLI
- Un wallet Metamask (Testnet BSC)

### Installation

#### 1. Backend

```bash
cd /app/backend

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer .env
# Le fichier .env est déjà configuré avec BSC Testnet

# Lancer le serveur
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### 2. Frontend

```bash
cd /app/frontend

# Installer les dépendances
yarn install

# Lancer l'application
yarn start

# Pour tester sur mobile
# Scannez le QR code avec Expo Go (iOS/Android)
```

---

## 🔑 Configuration du Wallet Marchand

### Première utilisation

1. **Ouvrir l'application**
2. **Modal de configuration** s'affiche automatiquement
3. **Entrer votre adresse Metamask** (BSC Testnet)
   - Format : `0x...` (42 caractères)
   - Exemple : `0x742D5Cc6bF2442E8C7c74c7b4Be6AB9d6f10f5B4`
4. **Confirmer** et le wallet est configuré

### Obtenir des tokens de test

Pour tester l'application sur BSC Testnet :

1. **Obtenir du BNB Testnet** :
   - https://testnet.bnbchain.org/faucet-smart

2. **Vérifier vos tokens** sur BscScan Testnet :
   - https://testnet.bscscan.com/

---

## 💳 Utilisation - Paiement Crypto

### Créer un nouveau paiement

1. **Accueil** → Bouton "Nouveau Paiement"
2. **Choisir la devise** : XAF Stable, EUROM Stable ou TND Stable
3. **Entrer le montant** via le clavier numérique
4. **Sélectionner "Paiement par lien (Metamask)"**

### Processus de paiement

1. **Génération du QR code** et du lien de paiement
2. **Partage** : Le client scanne le QR ou utilise le lien
3. **Metamask du client** : Confirmation et signature
4. **Transaction blockchain** : Validation on-chain
5. **Confirmation** : Réception confirmée dans l'app

### Suivi de transaction

- **Statuts** : Pending → Processing → Confirmed / Failed
- **Détails** : Hash, bloc, adresses, montant
- **Historique** : Filtrable par statut et devise

---

## 🔄 Remboursements

### Processus

1. **Accéder à Remboursements**
2. **Entrer l'ID de transaction** à rembourser
3. **Montant** (optionnel, sinon total)
4. **Raison** du remboursement
5. **Confirmer** → Demande créée
6. **Traitement manuel** requis (Phase 1)

**Note** : Les remboursements crypto nécessitent une validation manuelle pour sécuriser les fonds.

---

## 📊 API Backend - Endpoints Principaux

### Blockchain

```bash
# Status de la connexion blockchain
GET /api/blockchain/status

Response:
{
  "connected": true,
  "chain_id": 97,
  "latest_block": 74577119,
  "gas_price_gwei": 0.1
}
```

### Wallet

```bash
# Configurer le wallet marchand
POST /api/wallet/configure
Body: {
  "merchant_address": "0x..."
}

# Obtenir le wallet configuré
GET /api/wallet/merchant
```

### Balance

```bash
# Obtenir les balances
POST /api/balance
Body: {
  "wallet_address": "0x...",
  "token_symbol": "all"
}

Response:
{
  "wallet_address": "0x...",
  "bnb_balance": "0.1234",
  "tokens": [
    {
      "symbol": "XAF_STABLE",
      "name": "XAF_STABLE",
      "balance": "1000000000000000000",
      "balance_formatted": "1.0",
      "contract_address": "0x..."
    }
  ]
}
```

### Paiements

```bash
# Créer un lien de paiement
POST /api/payment/create-link
Body: {
  "amount": 100.0,
  "currency": "XAF_STABLE",
  "recipient_address": "0x...",
  "description": "Optional description"
}

Response:
{
  "payment_id": "uuid",
  "amount": 100.0,
  "currency": "XAF_STABLE",
  "recipient_address": "0x...",
  "payment_link": "tpecrypto://pay/uuid",
  "qr_data": "{...}",
  "status": "pending",
  "created_at": "2025-01-19T10:00:00"
}

# Détails d'un paiement
GET /api/payment/{payment_id}
```

### Transactions

```bash
# Créer une transaction
POST /api/transaction/create
Body: {
  "payment_id": "uuid",
  "tx_hash": "0x...",
  "from_address": "0x...",
  "to_address": "0x...",
  "amount": 100.0,
  "currency": "XAF_STABLE",
  "payment_type": "crypto_link"
}

# Status d'une transaction
GET /api/transaction/{tx_hash}

# Liste des transactions
GET /api/transactions?limit=50&status=confirmed&currency=XAF_STABLE
```

### Remboursements

```bash
# Demander un remboursement
POST /api/refund/process
Body: {
  "transaction_id": "uuid",
  "amount": 50.0,  // optionnel
  "reason": "Raison du remboursement"
}
```

### Tokens

```bash
# Liste des tokens supportés
GET /api/tokens/supported

Response:
{
  "tokens": [
    {
      "symbol": "XAF_STABLE",
      "name": "XAF_STABLE",
      "key": "XAF_STABLE",
      "decimals": 18,
      "contract_address": "0x..."
    }
  ],
  "network": "BSC Testnet"
}
```

---

## 🎨 Écrans de l'Application

### 1. Accueil (index.tsx)
- Dashboard avec solde total
- Balance par token
- Boutons d'action rapide
- Configuration wallet

### 2. Nouveau Paiement (nouveau-paiement.tsx)
- Sélection de devise
- Saisie du montant
- Choix du moyen de paiement
- Indicateur de progression

### 3. Paiement par Lien (paiement-lien.tsx)
- Génération QR code
- Instructions pour le client
- Suivi en temps réel
- Confirmation/Échec

### 4. Transactions (transactions.tsx)
- Liste des transactions
- Filtres (statut, devise)
- Détails complets
- Refresh to update

### 5. Remboursements (remboursements.tsx)
- Formulaire de remboursement
- Validation
- Processus expliqué

### 6. Paramètres (parametres.tsx)
- Configuration TPE
- Wallet marchand
- Informations blockchain
- Sécurité

### 7. Support (support.tsx)
- FAQ complète
- Contact support
- Ressources
- Informations app

---

## 🔐 Sécurité

### Implémentée

- ✅ Transactions signées on-chain
- ✅ Validation des adresses
- ✅ CORS configuré
- ✅ HTTPS (en production)
- ✅ Validation des montants

### À implémenter (Phase 2)

- 🔜 Authentification PIN
- 🔜 Biométrie (Touch ID / Face ID)
- 🔜 Chiffrement local
- 🔜 Double vérification remboursements
- 🔜 Rate limiting avancé

---

## 🧪 Tests

### Backend

```bash
# Tester la connexion
curl http://localhost:8001/api/

# Tester blockchain status
curl http://localhost:8001/api/blockchain/status

# Tester les tokens supportés
curl http://localhost:8001/api/tokens/supported

# Tester balance (remplacer l'adresse)
curl -X POST http://localhost:8001/api/balance \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0xYourAddress"}'
```

### Frontend

1. Ouvrir l'app avec Expo Go
2. Tester la configuration wallet
3. Créer un paiement test
4. Vérifier le QR code
5. Consulter l'historique

---

## 🐛 Troubleshooting

### Backend ne se connecte pas à BSC

```bash
# Vérifier la connectivité
curl https://data-seed-prebsc-1-s1.binance.org:8545

# Vérifier les logs
tail -f /var/log/supervisor/backend.err.log
```

### Frontend ne charge pas

```bash
# Nettoyer le cache
cd /app/frontend
rm -rf node_modules .expo
yarn install
yarn start --clear
```

### Tokens ne s'affichent pas

- Vérifier que l'adresse wallet est valide
- Vérifier la connexion BSC Testnet
- Vérifier que les contrats de tokens sont corrects

---

## 📱 Génération de l'APK

Pour générer l'APK Android :

```bash
cd /app/frontend

# Build de production
eas build --platform android --profile production

# Ou build local
expo build:android
```

---

## 🔮 Roadmap

### Phase 2 - Intégration Carte (Q2 2025)
- [ ] Lecteur NFC
- [ ] Lecteur USB-C
- [ ] Lecteur Bluetooth
- [ ] Support cartes ISO/JavaCard
- [ ] Authentification PIN carte

### Phase 3 - Fonctionnalités Avancées (Q3 2025)
- [ ] Multi-signatures
- [ ] Paiements récurrents
- [ ] Analytics avancés
- [ ] Export comptable
- [ ] Multi-devises fiat

### Phase 4 - Déploiement Mainnet (Q4 2025)
- [ ] Migration BSC Mainnet
- [ ] Audit de sécurité
- [ ] Certification bancaire
- [ ] Support client 24/7

---

## 📞 Support

- **Email** : support@tpecrypto.com
- **Documentation** : Ce fichier README
- **Issues** : GitHub Issues (si applicable)

---

## 📄 Licence

© 2025 TPE Crypto. Tous droits réservés.

---

## 🙏 Remerciements

- **BSC Testnet** pour l'infrastructure blockchain
- **Expo** pour le framework mobile
- **FastAPI** pour le backend rapide
- **MongoDB** pour le stockage des données
- **web3.js/ethers.js** pour l'intégration blockchain

---

**Note** : Cette application est actuellement en phase BETA sur testnet. Ne pas utiliser en production avec de vrais fonds sans audit de sécurité complet.
