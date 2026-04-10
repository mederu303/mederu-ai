import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';

// Fallback stub for when BeaconWallet is not yet installed
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

const RPC_ENDPOINT = 'https://mainnet.api.tez.ie';
export const Tezos = new TezosToolkit(RPC_ENDPOINT);

interface WalletContextType {
  wallet: any | null;
  userAddress: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  wallet: null,
  userAddress: null,
  connectionStatus: 'idle',
  connectionError: null,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
});

export const useTezosWallet = () => useContext(WalletContext);

export const TezosWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<any | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    let initWallet: any = null;
    
    try {
      // Dynamic require or standard import assuming packages will be installed
      initWallet = new BeaconWallet({
        name: 'mederu AI Studio',
        preferredNetwork: 'mainnet' as any,
      });
      setWallet(initWallet);
      Tezos.setWalletProvider(initWallet);

      initWallet.client.getActiveAccount().then((activeAccount: any) => {
        if (activeAccount) {
          setUserAddress(activeAccount.address);
          setConnectionStatus('connected');
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('BeaconWallet init failed. Waiting for dependencies to be installed.');
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!wallet) return;
    setConnectionStatus('connecting');
    setConnectionError(null);
    try {
      await wallet.requestPermissions();
      const activeAccount = await wallet.client.getActiveAccount();
      if (activeAccount) {
        setUserAddress(activeAccount.address);
        Tezos.setWalletProvider(wallet);
        setConnectionStatus('connected');
      }
    } catch (error: any) {
      console.error('[Tezos] Wallet connection failed:', error);
      setConnectionStatus('error');
      setConnectionError(error.message);
    }
  }, [wallet]);

  const disconnectWallet = useCallback(async () => {
    if (!wallet) return;
    await wallet.clearActiveAccount();
    setUserAddress(null);
    setConnectionStatus('idle');
  }, [wallet]);

  if (!isMounted) return <>{children}</>;

  return (
    <WalletContext.Provider
      value={{
        wallet,
        userAddress,
        connectionStatus,
        connectionError,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
