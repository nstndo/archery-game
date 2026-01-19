'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base, baseSepolia } from 'viem/chains'; // Добавляем baseSepolia для тестов
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [config] = useState(() =>
    createConfig({
      // ВАЖНО: Добавляем baseSepolia в список поддерживаемых сетей для тестирования
      chains: [base, baseSepolia], 
      connectors: [
        coinbaseWallet({
          appName: 'Base Archery',
        }),
      ],
      transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(), // Транспорт для Sepolia
      },
    })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={base} // Для OnchainKit можно оставить base
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}