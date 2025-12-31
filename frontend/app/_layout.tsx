import React from 'react';
import { Stack } from 'expo-router';
import { WalletProvider } from '../context/WalletContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="nouveau-paiement" />
          <Stack.Screen name="paiement-lien" />
          <Stack.Screen name="paiement-carte-br301" />
          <Stack.Screen name="paiement-carte-jcop" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="remboursements" />
          <Stack.Screen name="parametres" />
          <Stack.Screen name="support" />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
