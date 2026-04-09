'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { defineChain } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
export const etherlinkTestnet = defineChain({ id: 128123, name: 'Etherlink Testnet', nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 }, rpcUrls: { default: { http: ['https://node.ghostnet.etherlink.com'] } }, blockExplorers: { default: { name: 'Etherlink Explorer', url: 'https://testnet.explorer.etherlink.com' } }, testnet: true });
const config = getDefaultConfig({ appName: 'mederu AI', projectId: '87f9acfa5eb566258c4e9376f782edbb', chains: [etherlinkTestnet], ssr: true });
const queryClient = new QueryClient();
export function Providers({ children }: { children: React.ReactNode }) {
  return (<WagmiProvider config={config}><QueryClientProvider client={queryClient}><RainbowKitProvider theme={darkTheme({ accentColor: '#34d399', accentColorForeground: 'black' })}>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>);
}
