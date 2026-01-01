#!/bin/bash
# ============================================
# 🚀 Script de Génération APK - TPE Crypto
# ============================================
# Exécutez ce script sur votre ordinateur
# après avoir téléchargé le projet

echo "📱 Génération APK TPE Crypto"
echo "============================"

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "   Téléchargez-le sur: https://nodejs.org/"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

echo "✅ Node.js détecté: $(node -v)"
echo "✅ npm détecté: $(npm -v)"

# Installer EAS CLI
echo ""
echo "📦 Installation de EAS CLI..."
npm install -g eas-cli

# Vérifier l'installation
if ! command -v eas &> /dev/null; then
    echo "❌ Erreur lors de l'installation de EAS CLI"
    exit 1
fi

echo "✅ EAS CLI installé: $(eas --version)"

# Se connecter à Expo
echo ""
echo "🔐 Connexion à Expo..."
echo "   (Créez un compte gratuit sur https://expo.dev si nécessaire)"
eas login

# Aller dans le dossier frontend
cd frontend

# Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install

# Générer l'APK
echo ""
echo "🔨 Génération de l'APK..."
echo "   Cela peut prendre 10-15 minutes..."
eas build --platform android --profile preview --non-interactive

echo ""
echo "✅ Terminé !"
echo "   Téléchargez l'APK depuis le lien fourni ci-dessus"
echo "   Installez-le sur votre téléphone Android"
