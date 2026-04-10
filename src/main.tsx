import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TezosWalletProvider } from './contexts/WalletContext';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

import { defineChain } from 'viem';

const etherlinkTestnet = defineChain({
  id: 128123,
  name: 'Etherlink Testnet',
  nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://node.ghostnet.etherlink.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherlink Explorer', url: 'https://testnet.explorer.etherlink.com' },
  },
  testnet: true,
});

const etherlinkMainnet = defineChain({
  id: 42793,
  name: 'Etherlink',
  nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://node.mainnet.etherlink.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherlink Explorer', url: 'https://explorer.etherlink.com' },
  },
});

const config = getDefaultConfig({
  appName: 'mederu AI',
  projectId: 'ec3b1d1f73b06deadd856ba63d08ddbe',
  chains: [etherlinkMainnet, etherlinkTestnet],
  transports: {
    [etherlinkMainnet.id]: http('https://node.mainnet.etherlink.com'),
    [etherlinkTestnet.id]: http('https://node.ghostnet.etherlink.com'),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#10b981',
          accentColorForeground: 'white',
          borderRadius: 'large',
        })}>
          <TezosWalletProvider>
            <App />
          </TezosWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
