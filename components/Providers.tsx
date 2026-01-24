'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() =>
    createConfig({
      chains: [base],
      connectors: [
        coinbaseWallet({
          appName: 'Base Archery',
          preference: 'smartWalletOnly',
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
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}