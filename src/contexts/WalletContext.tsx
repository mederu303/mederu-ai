import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Tezos wallet context - lazy loaded to avoid polyfill issues
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

// Create TezosToolkit lazily only when needed
let _Tezos: any = null;
const getTezos = () => {
  if (!_Tezos) {
    try {
      const { TezosToolkit } = require('@taquito/taquito');
      _Tezos = new TezosToolkit('https://mainnet.api.tez.ie');
    } catch (e) {
      console.warn('[Tezos] TezosToolkit not available');
    }
  }
  return _Tezos;
};

// Export Tezos as a getter for backward compatibility
export const Tezos = new Proxy({} as any, {
  get: (_target, prop) => {
    const tezos = getTezos();
    return tezos ? tezos[prop] : undefined;
  }
});

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

  const connectWallet = useCallback(async () => {
    setConnectionStatus('connecting');
    setConnectionError(null);
    try {
      const { BeaconWallet } = await import('@taquito/beacon-wallet');
      const tezos = getTezos();
      
      const beaconWallet = new BeaconWallet({
        name: 'mederu AI Studio',
        preferredNetwork: 'mainnet' as any,
      });
      
      await beaconWallet.requestPermissions();
      const activeAccount = await beaconWallet.client.getActiveAccount();
      
      if (activeAccount) {
        setWallet(beaconWallet);
        setUserAddress(activeAccount.address);
        if (tezos) tezos.setWalletProvider(beaconWallet);
        setConnectionStatus('connected');
      }
    } catch (error: any) {
      console.error('[Tezos] Wallet connection failed:', error);
      setConnectionStatus('error');
      setConnectionError(error.message);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (!wallet) return;
    await wallet.clearActiveAccount();
    setUserAddress(null);
    setConnectionStatus('idle');
  }, [wallet]);

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
