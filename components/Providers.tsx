'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Create a new QueryClient instance
  const [queryClient] = useState(() => new QueryClient());

  // Configure Wagmi with Coinbase Wallet and Base chain
  const [config] = useState(() =>
    createConfig({
      chains: [base],
      connectors: [
        coinbaseWallet({
          appName: 'Base Archery',
        }),
      ],
      transports: {
        [base.id]: http(),
      },
    })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}