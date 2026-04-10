import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Sparkles, 
  Eye, 
  User as UserIcon, 
  LogOut, 
  RefreshCw, 
  TrendingUp,
  LayoutGrid,
  History,
  Settings,
  Bot,
  AlertCircle,
  Twitter,
  Heart,
  Trash2,
  Languages,
  X,
  Key,
  Maximize
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  limit,
  deleteDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Artwork, CuratedPost, UserProfile, AlchemistResult } from './types';
import { generateArtwork, curateFeed, translateToJapanese, alchemyInterpret, PRESETS } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-red-500">Something went wrong</h1>
            <pre className="bg-zinc-900 p-4 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(this.state.error, null, 2)}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white text-black rounded-full font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    console.log("App mounted. window.aistudio available:", !!window.aistudio);
    if (window.aistudio) {
      console.log("window.aistudio methods:", Object.keys(window.aistudio));
    }
  }, []);

  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function MainApp() {
  const { isConnected } = useAccount();
  const [user, setUser] = useState<User | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [curations, setCurations] = useState<CuratedPost[]>([]);
  const [alchemistResults, setAlchemistResults] = useState<AlchemistResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAlchemizing, setIsAlchemizing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<string | null>(null);
  const [alchemyUrl, setAlchemyUrl] = useState('');
  const [alchemyImage, setAlchemyImage] = useState<string | null>(null);
  const [isAlchemyDragging, setIsAlchemyDragging] = useState(false);
  const alchemyFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'gallery' | 'curator' | 'alchemist' | 'future'>('gallery');
  const [isAutonomous, setIsAutonomous] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isJapaneseMode, setIsJapaneseMode] = useState(false);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualApiKey, setManualApiKey] = useState(localStorage.getItem('GEMINI_API_KEY_MANUAL') || '');
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'studio' | 'alchemist' | 'autonomous'>('all');
  const [hideGalleryText, setHideGalleryText] = useState(false);
  const [alchemistViewMode, setAlchemistViewMode] = useState<'large' | 'grid'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [lineageContractAddress, setLineageContractAddress] = useState(localStorage.getItem('ETHERLINK_CONTRACT') || '');
  const { writeContractAsync } = useWriteContract();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const [showDebug, setShowDebug] = useState(false);
  const [twitterTokens, setTwitterTokens] = useState<{ accessToken: string, refreshToken: string } | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'TWITTER_AUTH_SUCCESS' && user) {
        const tokens = event.data.tokens;
        setTwitterTokens(tokens);
        // Save to Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { twitterTokens: tokens }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'users'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const checkKey = async (retries = 15) => {
      // Check manual key first
      if (localStorage.getItem('GEMINI_API_KEY_MANUAL')) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio?.hasSelectedApiKey) {
        try {
          const has = await window.aistudio.hasSelectedApiKey();
          console.log("Initial API key check:", has);
          setHasApiKey(has);
        } catch (e) {
          console.error("Error checking API key:", e);
        }
      } else if (retries > 0) {
        setTimeout(() => checkKey(retries - 1), 1000);
      } else {
        console.warn("window.aistudio not found after 15 seconds. API key selection may be unavailable.");
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async (): Promise<boolean> => {
    console.log("Attempting to open API key selection dialog...");
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        console.log("Dialog opened successfully");
        
        setHasApiKey(true);
        setSuccess("API key selection dialog opened.");
        
        if (window.aistudio?.hasSelectedApiKey) {
          setTimeout(async () => {
            const has = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(has);
          }, 2000);
        }
        return true;
      } catch (e) {
        console.error("Failed to open API key dialog:", e);
        setError("Could not open API key dialog.");
        return false;
      }
    } else {
      console.warn("window.aistudio.openSelectKey is not available. Showing manual input.");
      setShowManualKeyInput(true);
      setIsSettingsOpen(true);
      setError("API selection dialog is only available inside AI Studio. Please enter your API key manually in Settings.");
      return false;
    }
  };

  const handleConnectTwitter = async () => {
    try {
      const response = await fetch('/api/auth/twitter/url');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to get auth URL");
      }

      if (data.url) {
        window.open(data.url, 'twitter_auth', 'width=600,height=700');
      } else {
        throw new Error("No authorization URL received from server.");
      }
    } catch (err: any) {
      console.error("Twitter Connect Error:", err);
      setError(err.message || "Failed to start Twitter connection.");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', u.uid);
        getDoc(userRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.twitterTokens) {
              setTwitterTokens(data.twitterTokens);
            }
          } else {
            setDoc(userRef, {
              displayName: u.displayName || 'Anonymous',
              photoURL: u.photoURL || '',
              bio: 'AI Art Enthusiast'
            }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'users'));
          }
        }).catch(e => handleFirestoreError(e, OperationType.GET, 'users'));
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'artworks'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        let source = data.source;
        
        // Heuristic for legacy data or missing source
        if (!source) {
          const isAlchemistStyle = data.style === 'Alchemical' || 
                                  (data.style && !PRESETS.includes(data.style)) ||
                                  data.title?.toLowerCase().includes('synthesis');
          const isAutonomous = data.title?.toLowerCase().includes('autonomous') || 
                              data.description?.toLowerCase().includes('autonomous');
          source = isAlchemistStyle ? 'alchemist' : isAutonomous ? 'autonomous' : 'studio';
        }
        
        return { id: d.id, ...data, source } as Artwork;
      });
      setArtworks(docs);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'artworks'));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'curations'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CuratedPost));
      setCurations(docs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'alchemist_results'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AlchemistResult));
      setAlchemistResults(docs);
    });
    return unsubscribe;
  }, []);

  // Autonomous generation loop simulation
  useEffect(() => {
    if (!isAutonomous || !user) return;

    const interval = setInterval(async () => {
      console.log("Autonomous mode: Generating new artwork...");
      handleGenerate('autonomous');
    }, 60000 * 5); // Every 5 minutes

    return () => clearInterval(interval);
  }, [isAutonomous, user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const refreshCurator = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const curation = await curateFeed(artworks.slice(0, 5));
      await addDoc(collection(db, 'curations'), curation);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'curations');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Prompt copied to clipboard!");
  };

  const handleLike = async (art: Artwork) => {
    if (!user) return;
    const artRef = doc(db, 'artworks', art.id);
    const likedBy = art.likedBy || [];
    const isLiked = likedBy.includes(user.uid);
    
    const newLikedBy = isLiked 
      ? likedBy.filter(id => id !== user.uid)
      : [...likedBy, user.uid];
      
    try {
      await updateDoc(artRef, { likedBy: newLikedBy });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'artworks');
    }
  };

  const handleTranslate = async (id: string, text: string) => {
    if (translations[id]) return;

    setIsTranslating(id);
    try {
      console.log(`Translating ${id}...`);
      const translated = await translateToJapanese(text);
      setTranslations(prev => ({ ...prev, [id]: translated }));
    } catch (e) {
      console.error(`Translation failed for ${id}`, e);
    } finally {
      setIsTranslating(null);
    }
  };

  const handleGlobalTranslate = async () => {
    if (isJapaneseMode) {
      setIsJapaneseMode(false);
      return;
    }

    setIsJapaneseMode(true);
    
    // Trigger translations for all visible curations
    curations.forEach(curation => {
      if (!translations[`${curation.id}_content`]) {
        handleTranslate(`${curation.id}_content`, curation.content);
      }
      if (!translations[`${curation.id}_note`]) {
        handleTranslate(`${curation.id}_note`, curation.curatorComment);
      }
    });

    // Trigger translations for all visible artworks
    artworks.forEach(art => {
      if (!translations[art.id]) {
        handleTranslate(art.id, art.description);
      }
    });
  };

  const handleGenerate = async (source: 'studio' | 'autonomous' = 'studio') => {
    if (!user || isGenerating) return;
    
    let currentHasKey = hasApiKey;
    if (!currentHasKey) {
      console.log("No API key set, attempting to open selection dialog...");
      currentHasKey = await handleSelectKey();
    }

    if (!currentHasKey) {
      console.log("API key selection failed or was cancelled.");
      setError("API key is required. Please click the 'Set API Key' button or the generation button again to select a key.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      // Get liked styles for context
      const likedArtworks = artworks.filter(a => a.likedBy?.includes(user.uid));
      const likedStyles = Array.from(new Set(likedArtworks.map(a => a.style)));

      const newArtwork = await generateArtwork(user.uid, likedStyles);
      if (!newArtwork.imageUrl) {
        throw new Error("AI failed to generate an image. Please check your API key and quota.");
      }
      
      try {
        const artworkWithSource = { ...newArtwork, source };
        const docRef = await addDoc(collection(db, 'artworks'), artworkWithSource);
        
        // Auto-curate sometimes
        if (Math.random() > 0.7) {
          const curation = await curateFeed(artworks.slice(0, 5));
          await addDoc(collection(db, 'curations'), curation).catch(e => handleFirestoreError(e, OperationType.CREATE, 'curations'));
        }

        // Auto-tweet if connected
        if (twitterTokens) {
          try {
            await fetch('/api/twitter/tweet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `🎨"${newArtwork.title}" by mederu AI @mederu_art\n${window.location.origin}/share/${docRef.id}`,
                accessToken: twitterTokens.accessToken,
                artworkId: docRef.id
              })
            });
            console.log("Tweeted successfully!");
          } catch (tweetErr) {
            console.error("Failed to tweet:", tweetErr);
          }
        }
      } catch (firestoreErr: any) {
        // Handle Firestore specific errors (like size limit or permissions)
        console.error("Firestore save failed", firestoreErr);
        if (firestoreErr.message?.includes('permission-denied')) {
          setError("Permission denied. Your account might not have access to save artworks.");
        } else if (firestoreErr.message?.includes('quota-exceeded')) {
          setError("Firestore quota exceeded. Please try again tomorrow.");
        } else {
          setError("Failed to save artwork to database. The image might be too large.");
        }
        // Still call the system error handler for diagnostics
        handleFirestoreError(firestoreErr, OperationType.CREATE, 'artworks');
      }
    } catch (err: any) {
      console.error("Generation failed", err);
      // If it's already a JSON string from handleFirestoreError, try to parse it or just show it
      try {
        const parsed = JSON.parse(err.message);
        setError(`Error: ${parsed.error || "Unknown error"}`);
      } catch {
        setError(err.message || "Generation failed. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAlchemy = async () => {
    if (!user || (!alchemyUrl && !alchemyImage) || isAlchemizing) return;
    
    let currentHasKey = hasApiKey;
    if (!currentHasKey) {
      currentHasKey = await handleSelectKey();
    }

    if (!currentHasKey) {
      setError("API key is required for Alchemical synthesis.");
      return;
    }

    setIsAlchemizing(true);
    setError(null);
    try {
      const result = await alchemyInterpret(user.uid, alchemyUrl || undefined, alchemyImage || undefined);
      
      const alchemistData = {
        url: alchemyUrl || 'Direct Upload',
        dna: result.dna,
        interpretation: result.interpretation,
        artwork: result.artwork,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'alchemist_results'), alchemistData);
      // Also add the artwork to the main gallery
      await addDoc(collection(db, 'artworks'), { ...result.artwork, source: 'alchemist' as const });
      
      setSuccess("Alchemical synthesis complete!");
      setAlchemyUrl('');
      setAlchemyImage(null);
    } catch (err: any) {
      console.error("Alchemy failed", err);
      setError(err.message || "Alchemical synthesis failed.");
    } finally {
      setIsAlchemizing(false);
    }
  };

  const handleAlchemyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAlchemyImage(reader.result as string);
        setAlchemyUrl('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAlchemyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAlchemyDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAlchemyImage(reader.result as string);
        setAlchemyUrl('');
      };
      reader.readAsDataURL(file);
    }
  };

  const shareToTwitter = (art: Artwork) => {
    const text = `🎨"${art.title}" by mederu AI @mederu_art`;
    const shareUrl = `${window.location.origin}/share/${art.id}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleShareAlt = async (art: Artwork) => {
    if (isSharing) return;
    setIsSharing(art.id);
    try {
      const response = await fetch('/api/twitter/share-alt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎨"${art.title}" by mederu AI @mederu_art`,
          artworkId: art.id
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess("Successfully shared via Alternative API!");
      } else {
        throw new Error(data.error || "Failed to share");
      }
    } catch (err: any) {
      console.error("Share Alt Error:", err);
      setError(err.message || "Failed to share via Alternative API. Check your RapidAPI configuration.");
    } finally {
      setIsSharing(null);
    }
  };

  const ERC721_ABI = [
    {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"tokenURI","type":"string"}],"name":"mintLineage","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}
  ];

  const handleMintToEtherlink = async (art: Artwork) => {
    if (!isConnected || !address) {
      setError("Please connect your wallet using the button in the top right.");
      return;
    }
    
    if (!lineageContractAddress) {
      setError("Please set your Etherlink Contract Address in Settings first.");
      setIsSettingsOpen(true);
      return;
    }
    
    setIsMinting(true);
    setMintResult(null);
    try {
      // Execute the actual on-chain transaction against the configured contract
      const hash = await writeContractAsync({
        address: lineageContractAddress as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'mintLineage',
        args: [address, art.imageUrl],
      });
      
      setMintResult(hash);
      setSuccess(`Successfully initiated minting on Etherlink Testnet!`);
    } catch (err: any) {
      console.error("Mint Error:", err);
      setError(err.message || "Failed to mint. Please check the contract address and try again.");
    } finally {
      setIsMinting(false);
    }
  };

  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const handleDeleteCuration = async (id: string) => {
    if (!user || user.email !== 'guruguruhyena@gmail.com') return;
    try {
      await deleteDoc(doc(db, 'curations', id));
      setSuccess("投稿を削除しました。");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `curations/${id}`);
    }
  };

  const handleDeleteArtwork = async (art: Artwork) => {
    if (!user) return;
    const isAdminUser = user.email === 'guruguruhyena@gmail.com';
    const isCreator = art.creatorId === user.uid;
    
    if (!isCreator && !isAdminUser) {
      setError("You can only delete your own creations.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'artworks', art.id));
      setSuccess(`"${art.title}" has been deleted.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `artworks/${art.id}`);
    }
  };

  const cleanupOldCurations = async () => {
    if (!user || user.email !== 'guruguruhyena@gmail.com') return;
    setShowCleanupConfirm(false);
    setIsCleaning(true);
    try {
      const cutOffDate = "2026-03-10T00:00:00.000Z";
      const q = query(collection(db, 'curations'), where('createdAt', '<', cutOffDate));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(d => 
        deleteDoc(doc(db, 'curations', d.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `curations/${d.id}`))
      );
      
      await Promise.all(deletePromises);
      setSuccess(`${snapshot.size}件の古い投稿を削除しました。`);
    } catch (err: any) {
      console.error("Cleanup error:", err);
      setError("削除に失敗しました。");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteAlchemistResult = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'alchemist_results', id));
      setSuccess("Alchemist result deleted.");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `alchemist_results/${id}`);
    }
  };

  const handleOfficialTweet = async (art: Artwork) => {
    if (!twitterTokens || isSharing) return;
    setIsSharing(art.id);
    try {
      const response = await fetch('/api/twitter/tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎨"${art.title}" by mederu AI @mederu_art\n${window.location.origin}/share/${art.id}`,
          accessToken: twitterTokens.accessToken,
          artworkId: art.id
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess("Successfully posted to Twitter with image!");
      } else {
        throw new Error(data.error || "Failed to post");
      }
    } catch (err: any) {
      console.error("Official Tweet Error:", err);
      setError(err.message || "Failed to post to Twitter.");
    } finally {
      setIsSharing(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <Sparkles className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter italic">mederu AI</h1>
            <p className="text-zinc-400 text-lg">Autonomous Art Studio on Tezos</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-bold rounded-full hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 group"
          >
            <UserIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Connect with Google
          </button>
          
          <p className="text-xs text-zinc-600 uppercase tracking-widest">Powered by Gemini 2.5 & Tezos</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans">
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0a0a] border-l border-white/10 z-[70] p-8 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-2">
                  <Settings className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic">System Settings</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-10">
                <section className="space-y-4">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Model Configuration</h3>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-bold">Gemini API Key</p>
                      <p className="text-xs text-zinc-500">Required for high-quality image generation.</p>
                      
                      {window.aistudio?.openSelectKey ? (
                        <button 
                          onClick={handleSelectKey}
                          className={cn(
                            "w-full py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                            hasApiKey ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500 text-black"
                          )}
                        >
                          <Key className="w-4 h-4" />
                          {hasApiKey ? "Key Configured" : "Set API Key"}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative">
                            <input 
                              type="password"
                              value={manualApiKey}
                              onChange={(e) => {
                                setManualApiKey(e.target.value);
                                localStorage.setItem('GEMINI_API_KEY_MANUAL', e.target.value);
                                setHasApiKey(!!e.target.value);
                              }}
                              placeholder="Enter your Gemini API Key"
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                            />
                            <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          </div>
                          <p className="text-[10px] text-zinc-600 leading-relaxed">
                            Since you are running outside of AI Studio, please provide your own API key. 
                            It is stored locally in your browser.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Etherlink Settings</h3>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-bold">Smart Contract Address</p>
                      <p className="text-xs text-zinc-500">Provide your Mederu Lineage contract address.</p>
                      
                      <div className="relative">
                        <input 
                          type="text"
                          value={lineageContractAddress}
                          onChange={(e) => {
                            setLineageContractAddress(e.target.value);
                            localStorage.setItem('ETHERLINK_CONTRACT', e.target.value);
                          }}
                          placeholder="e.g. 0x1234abcd..."
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-relaxed">
                        Ensure this is a deployed contract on the Etherlink Testnet.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Integrations</h3>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-bold">X (Twitter)</p>
                      <p className="text-xs text-zinc-500">Connect to post artworks autonomously.</p>
                      <button 
                        onClick={handleConnectTwitter}
                        className={cn(
                          "w-full py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                          twitterTokens ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                      >
                        <Twitter className="w-4 h-4" />
                        {twitterTokens ? "X Connected" : "Connect X Account"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-[0.2em]">Operation Mode</h3>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-bold">Autonomous Mode</p>
                        <p className="text-xs text-zinc-500">AI creates and posts automatically.</p>
                      </div>
                      <button 
                        onClick={() => setIsAutonomous(!isAutonomous)}
                        className={cn(
                          "w-14 h-8 rounded-full p-1 transition-all duration-300",
                          isAutonomous ? "bg-emerald-500" : "bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full transition-all duration-300",
                          isAutonomous ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                  </div>
                </section>

                {user && (
                  <section className="pt-10 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border border-white/10" alt="" />
                      <div>
                        <p className="text-sm font-bold">{user.displayName}</p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">×</button>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold"
          >
            <Sparkles className="w-5 h-5" />
            {success}
            <button onClick={() => setSuccess(null)} className="ml-2 hover:opacity-70">×</button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Navigation */}
      <nav className="border-b border-white/5 sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              <span className="font-black text-xl tracking-tighter italic">mederu AI</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full">
              {(['gallery', 'alchemist', 'curator'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-medium transition-all capitalize",
                    activeTab === tab ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAutonomous(!isAutonomous)}
              className={cn(
                "hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all",
                isAutonomous 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
                  : "bg-white/5 text-zinc-500 border-white/10 hover:border-emerald-500/50 hover:text-emerald-400"
              )}
            >
              <Bot className={cn("w-4 h-4", isAutonomous && "animate-pulse")} />
              {isAutonomous ? "Autonomous Active" : "Autonomous Off"}
            </button>

            <button 
              onClick={handleGlobalTranslate}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all",
                isJapaneseMode 
                  ? "bg-emerald-500 text-black border-emerald-500" 
                  : "bg-white/5 text-zinc-500 border-white/10 hover:border-emerald-500/50 hover:text-emerald-400"
              )}
              title={isJapaneseMode ? "Switch to English" : "Translate to Japanese"}
            >
              <Languages className="w-3.5 h-3.5" />
              {isJapaneseMode ? "JP" : "EN"}
            </button>
            
            <div className="h-8 w-[1px] bg-white/10" />
            
            <div className="flex items-center gap-2 bg-white/5 p-1.5 px-3 rounded-full border border-white/5">
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                title="Debug Info"
              >
                <AlertCircle className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-all relative group"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                {(!hasApiKey || !twitterTokens) && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 border border-[#050505] rounded-full" />
                )}
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <img src={user.photoURL || ''} className="w-7 h-7 rounded-full border border-white/10" alt="" />
            </div>
            
            <ConnectButton />

            <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {showDebug && (
          <div className="mb-8 p-6 bg-zinc-900 rounded-3xl border border-white/10 font-mono text-xs space-y-2">
            <p className="text-zinc-500 uppercase font-bold tracking-widest mb-4">System Debug Info</p>
            <p>window.aistudio available: {String(!!window.aistudio)}</p>
            <p>window.aistudio.openSelectKey: {String(!!window.aistudio?.openSelectKey)}</p>
            <p>window.aistudio.hasSelectedApiKey: {String(!!window.aistudio?.hasSelectedApiKey)}</p>
            <p>hasApiKey state: {String(hasApiKey)}</p>
            <p>User ID: {user.uid}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              Force Reload App
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'gallery' && (
            <motion.div 
              key="gallery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">Autonomous Studio</h2>
                  <p className="text-zinc-500 max-w-md">AI-generated masterpieces, autonomously crafted and curated.</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5">
                    {(['all', 'alchemist', 'autonomous'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setGalleryFilter(filter)}
                        className={cn(
                          "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                          galleryFilter === filter 
                            ? "bg-white text-black" 
                            : "text-zinc-500 hover:text-white"
                        )}
                      >
                        {filter === 'all' ? 'Everything' : filter === 'alchemist' ? 'Alchemist' : 'Autonomous'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setHideGalleryText(!hideGalleryText)}
                    className={cn(
                      "p-2 rounded-full border transition-all",
                      hideGalleryText 
                        ? "bg-emerald-500 text-black border-emerald-500" 
                        : "bg-white/5 text-zinc-500 border-white/10 hover:border-emerald-500/50 hover:text-emerald-400"
                    )}
                    title={hideGalleryText ? "Show Text" : "Hide Text"}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>

                <button 
                  onClick={() => handleGenerate('autonomous')}
                  disabled={isGenerating}
                  className={cn(
                    "group relative h-12 px-6 rounded-full flex items-center justify-center gap-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 font-bold uppercase tracking-widest text-xs",
                    !hasApiKey ? "bg-amber-500 text-black" : "bg-emerald-500 text-black"
                  )}
                >
                  <div className="absolute inset-0 rounded-full border-2 border-white/20 group-hover:scale-110 group-hover:opacity-0 transition-all duration-500" />
                  
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : !hasApiKey ? (
                    <Key className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  )}
                  <span>{isGenerating ? "Generating" : "generate"}</span>
                </button>
              </div>

              {!hasApiKey && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1">
                    <p className="text-amber-400 font-bold uppercase tracking-widest text-xs">Action Required</p>
                    <h3 className="text-xl font-bold">Connect your Google Cloud Billing</h3>
                    <p className="text-zinc-400 text-sm max-w-md">To use high-quality nanobanana 2 models, you need to provide your own API key. Costs will be billed directly to your account.</p>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline mt-2 inline-block">Learn about Gemini API Billing</a>
                  </div>
                  <button 
                    onClick={handleSelectKey}
                    className="px-8 py-4 bg-amber-500 text-black font-bold rounded-full hover:bg-amber-400 transition-all whitespace-nowrap"
                  >
                    Select API Key
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative bg-white/5 rounded-3xl overflow-hidden border border-emerald-500/30 aspect-square flex flex-col items-center justify-center p-12 text-center space-y-4 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
                  >
                    <div className="absolute inset-0 border border-white/10 rounded-3xl pointer-events-none" />
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center relative z-10">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                    </div>
                    <div className="space-y-2 relative z-10">
                      <p className="text-emerald-400 font-black uppercase italic tracking-tighter text-xl">Generating...</p>
                      <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">AI is crafting a masterpiece</p>
                    </div>
                  </motion.div>
                )}
                {artworks
                  .filter(art => {
                    if (galleryFilter === 'all') return true;
                    if (galleryFilter === 'autonomous') return art.source === 'autonomous' || art.source === 'studio';
                    return art.source === galleryFilter;
                  })
                  .map((art) => (
                  <motion.div 
                    layout
                    key={art.id}
                    className="group relative bg-white/5 rounded-3xl overflow-hidden border border-white/5 hover:border-white/20 transition-all"
                  >
                    <div 
                      className="aspect-square overflow-hidden relative cursor-zoom-in"
                      onClick={() => setSelectedArtwork(art)}
                    >
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      {art.source === 'alchemist' && (
                        <div className="absolute top-4 right-4 bg-violet-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-1.5 backdrop-blur-md bg-opacity-80">
                          <Sparkles className="w-3 h-3" />
                          Transmuted
                        </div>
                      )}
                      {hideGalleryText && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold truncate pr-4">{art.title}</h3>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLike(art);
                                }}
                                className={cn(
                                  "p-1.5 rounded-full transition-all",
                                  art.likedBy?.includes(user?.uid || '') 
                                    ? "bg-rose-500 text-white" 
                                    : "bg-white/20 text-white hover:bg-rose-500"
                                )}
                              >
                                <Heart className={cn("w-3 h-3", art.likedBy?.includes(user?.uid || '') && "fill-current")} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {!hideGalleryText && (
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold tracking-tight">{art.title}</h3>
                            <p className="text-xs text-emerald-400 font-mono uppercase tracking-widest">{art.style}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-zinc-400 text-sm line-clamp-2">
                            {isJapaneseMode && translations[art.id] ? translations[art.id] : art.description}
                          </p>
                          {art.prompt && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(art.prompt);
                              }}
                              className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-2 h-2" />
                              Click to copy prompt
                            </button>
                          )}
                        </div>
                        <div className="pt-4 flex items-center justify-between border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                              {art.source === 'alchemist' ? (
                                <TrendingUp className="w-3 h-3 text-violet-400" />
                              ) : art.source === 'autonomous' ? (
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Bot className="w-3 h-3 text-zinc-400" />
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                              {art.source === 'alchemist' ? 'Alchemist Work' : 'Autonomous'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLike(art);
                              }}
                              className={cn(
                                "p-2 rounded-full transition-all",
                                art.likedBy?.includes(user?.uid || '') 
                                  ? "bg-rose-500/20 text-rose-500" 
                                  : "bg-white/5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                              )}
                              title="Like"
                            >
                              <Heart className={cn("w-3 h-3", art.likedBy?.includes(user?.uid || '') && "fill-current")} />
                            </button>
                            {twitterTokens ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOfficialTweet(art);
                                }}
                                disabled={!!isSharing}
                                className={cn(
                                  "p-2 rounded-full transition-all",
                                  isSharing === art.id 
                                    ? "bg-sky-500/20 text-sky-400 animate-pulse" 
                                    : "bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white"
                                )}
                                title="Post to X (Official API with Image)"
                              >
                                <Twitter className="w-3 h-3" />
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareToTwitter(art);
                                }}
                                className="p-2 bg-sky-500/10 text-sky-400 rounded-full hover:bg-sky-500 hover:text-white transition-all"
                                title="Share on X (Intent)"
                              >
                                <Twitter className="w-3 h-3" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareAlt(art);
                              }}
                              disabled={!!isSharing}
                              className={cn(
                                "p-2 rounded-full transition-all",
                                isSharing === art.id 
                                  ? "bg-emerald-500/20 text-emerald-400 animate-pulse" 
                                  : "bg-white/5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                              )}
                              title="Share via Alternative API"
                            >
                              <Bot className="w-3 h-3" />
                            </button>
                            {(user?.uid === art.creatorId || user?.email === 'guruguruhyena@gmail.com') && (
                              <div className="flex items-center gap-2">
                                {deletingId === art.id ? (
                                  <div className="flex items-center gap-1 bg-red-500/20 rounded-full p-1 border border-red-500/30">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteArtwork(art);
                                        setDeletingId(null);
                                      }}
                                      className="px-2 py-1 bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest rounded-full hover:bg-red-600 transition-all"
                                    >
                                      Confirm
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(null);
                                      }}
                                      className="p-1 text-zinc-400 hover:text-white transition-all"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(art.id);
                                    }}
                                    className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-all"
                                    title="Delete Artwork"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'curator' && (
            <motion.div 
              key="curator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                  <Eye className="w-3 h-3" />
                  AI Curator Active
                </div>
                <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">Daily Feed</h2>
                <p className="text-zinc-500 max-w-md mx-auto">Extracting and analyzing the best of digital art today.</p>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  <button 
                    onClick={refreshCurator}
                    disabled={isGenerating}
                    className="px-6 py-2 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50"
                  >
                    {isGenerating ? "Analyzing..." : "Refresh Feed"}
                  </button>

                  {user?.email === 'guruguruhyena@gmail.com' && (
                    <button 
                      onClick={() => setShowCleanupConfirm(true)}
                      disabled={isCleaning}
                      className="px-6 py-2 bg-red-500/10 text-red-400 rounded-full text-xs font-bold uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-black transition-all disabled:opacity-50"
                    >
                      {isCleaning ? "Cleaning..." : "Cleanup Old Posts"}
                    </button>
                  )}
                </div>
              </div>

              {showCleanupConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                  <div className="bg-zinc-900 border border-white/10 rounded-3xl p-10 max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto flex items-center justify-center">
                      <Trash2 className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold">Bulk Cleanup</h3>
                      <p className="text-zinc-400">2026/3/10 以前の投稿をすべて削除しますか？ この操作は取り消せません。</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setShowCleanupConfirm(false)}
                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-full font-bold transition-all"
                      >
                        キャンセル
                      </button>
                      <button 
                        onClick={cleanupOldCurations}
                        className="flex-1 py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-all"
                      >
                        削除する
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {curations.map((curation) => (
                  <div key={curation.id} className="bg-white/5 rounded-3xl p-10 border border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-black" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{curation.source}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Curated {new Date(curation.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {user?.email === 'guruguruhyena@gmail.com' && (
                        <button 
                          onClick={() => handleDeleteCuration(curation.id)}
                          className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                          title="Delete Post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-lg text-zinc-300 leading-relaxed italic">
                        {isJapaneseMode && translations[`${curation.id}_content`] 
                          ? translations[`${curation.id}_content`] 
                          : `"${curation.content}"`}
                      </p>
                      <div className="p-6 bg-black/40 rounded-3xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-emerald-400 uppercase font-bold tracking-widest">Curator's Note</p>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          {isJapaneseMode && translations[`${curation.id}_note`] 
                            ? translations[`${curation.id}_note`] 
                            : curation.curatorComment}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'alchemist' && (
            <motion.div 
              key="alchemist"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto space-y-12 px-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Left Column: Title & URL Input */}
                <div className="lg:col-span-8 flex flex-col justify-between py-2">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-bold uppercase tracking-widest border border-violet-500/20">
                      <Bot className="w-3 h-3" />
                      Visual DNA Synthesis
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div className="space-y-2">
                        <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">The Alchemist</h2>
                        <p className="text-zinc-500 max-w-md">Input a URL to extract its visual DNA and synthesize a new interpretation.</p>
                      </div>
                      
                      <button
                        onClick={() => setAlchemistViewMode(alchemistViewMode === 'large' ? 'grid' : 'large')}
                        className="flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 text-zinc-500 border border-white/10 hover:border-violet-500/50 hover:text-violet-400 transition-all shrink-0"
                      >
                        {alchemistViewMode === 'large' ? (
                          <><LayoutGrid className="w-3.5 h-3.5" /> Grid View</>
                        ) : (
                          <><Maximize className="w-3.5 h-3.5" /> Large View</>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 mt-8">
                    <div className="relative group bg-white/5 p-2 rounded-3xl border border-white/10 focus-within:border-violet-500/50 transition-all">
                      <input 
                        type="text" 
                        value={alchemyUrl}
                        onChange={(e) => {
                          setAlchemyUrl(e.target.value);
                          if (e.target.value) setAlchemyImage(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleAlchemy();
                          }
                        }}
                        placeholder="Enter image feed or board URL (e.g., Pinterest)"
                        className="w-full bg-transparent px-6 py-4 text-white placeholder:text-zinc-600 focus:outline-none"
                      />
                      <button 
                        onClick={handleAlchemy}
                        disabled={isAlchemizing || (!alchemyUrl && !alchemyImage)}
                        className="absolute right-2 top-2 bottom-2 px-8 bg-violet-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-violet-500/20"
                      >
                        {isAlchemizing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Synthesize
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center font-medium opacity-60">
                      AI will analyze the visual essence and create a unique interpretation
                    </p>
                  </div>
                </div>

                {/* Right Column: Image Drop Area */}
                <div className="lg:col-span-4">
                  <div className="relative group p-2 bg-white/5 rounded-3xl border border-white/10 h-full">
                    <div 
                      className={cn(
                        "relative h-full min-h-[200px] rounded-2xl overflow-hidden transition-all duration-500",
                        isAlchemyDragging ? "scale-[0.98]" : ""
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsAlchemyDragging(true); }}
                      onDragLeave={() => setIsAlchemyDragging(false)}
                      onDrop={handleAlchemyDrop}
                      onDoubleClick={() => alchemyFileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={alchemyFileInputRef}
                        onChange={handleAlchemyFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      {alchemyImage ? (
                        <div className="relative h-full w-full group">
                          <img src={alchemyImage} className="w-full h-full object-cover" alt="Alchemy source" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setAlchemyImage(null); }}
                              className="p-4 bg-red-500 rounded-full text-white shadow-2xl hover:scale-110 transition-transform"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-xl p-3 rounded-xl border border-white/10 flex items-center justify-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">DNA Loaded</p>
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "w-full h-full bg-black/40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all duration-500",
                          isAlchemyDragging ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:border-white/20"
                        )}>
                          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Plus className="w-6 h-6 text-zinc-500" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-sm font-bold text-zinc-300 px-4">Drop image or click</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest opacity-60">Visual DNA Source</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(
                "gap-8",
                alchemistViewMode === 'large' ? "space-y-12" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}>
                {alchemistResults.map((result) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={result.id} 
                    className={cn(
                      "bg-white/5 rounded-3xl overflow-hidden border border-white/5 relative group",
                      alchemistViewMode === 'large' ? "grid grid-cols-1 md:grid-cols-2" : "flex flex-col"
                    )}
                  >
                    <button 
                      onClick={() => handleDeleteAlchemistResult(result.id)}
                      className="absolute top-4 right-4 z-20 p-2 bg-red-500/20 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"
                      title="Delete Result"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div 
                      className={cn(
                        "aspect-square cursor-zoom-in",
                        alchemistViewMode === 'large' ? "" : "w-full"
                      )}
                      onClick={() => setSelectedArtwork(result.artwork)}
                    >
                      <img 
                        src={result.artwork.imageUrl} 
                        alt={result.artwork.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className={cn(
                      "space-y-8 flex flex-col justify-center",
                      alchemistViewMode === 'large' ? "p-10" : "p-6"
                    )}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-violet-400">
                          <Eye className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Interpretation</span>
                        </div>
                        <h3 className={cn(
                          "font-black tracking-tighter uppercase italic leading-tight",
                          alchemistViewMode === 'large' ? "text-3xl" : "text-xl"
                        )}>{result.artwork.title}</h3>
                        <p className={cn(
                          "text-zinc-400 text-sm leading-relaxed",
                          alchemistViewMode === 'large' ? "" : "line-clamp-3"
                        )}>{result.interpretation}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(result.artwork.prompt);
                          }}
                          className="text-[8px] text-violet-400/60 uppercase font-bold tracking-widest hover:text-violet-400 transition-colors flex items-center gap-1"
                        >
                          <Sparkles className="w-2 h-2" />
                          Click to copy prompt
                        </button>
                      </div>

                      {alchemistViewMode === 'large' && (
                        <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-3">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Visual DNA Extracted</p>
                          <p className="text-zinc-300 text-xs font-mono leading-relaxed">{result.dna}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <History className="w-4 h-4 text-zinc-400" />
                          </div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest truncate max-w-[150px]">
                            {result.url === 'Direct Upload' ? 'Direct Upload' : (() => {
                              try {
                                return `from ${new URL(result.url).hostname}`;
                              } catch {
                                return result.url;
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoom Modal */}
        <AnimatePresence>
          {selectedArtwork && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/95 backdrop-blur-xl"
              onClick={() => setSelectedArtwork(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl w-full aspect-square md:aspect-auto md:h-full flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setSelectedArtwork(null)}
                  className="absolute -top-12 right-0 p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
                <img 
                  src={selectedArtwork.imageUrl} 
                  alt={selectedArtwork.title} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-8 text-center space-y-2">
                  <h3 className="text-2xl font-black tracking-tighter uppercase italic">{selectedArtwork.title}</h3>
                  <p className="text-emerald-400 text-xs font-mono uppercase tracking-widest mb-4">{selectedArtwork.style}</p>
                  
                  {mintResult ? (
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <Sparkles className="w-4 h-4" />
                      Minted on Etherlink (Tx: {mintResult.slice(0,6)}...{mintResult.slice(-4)})
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMintToEtherlink(selectedArtwork); }}
                      disabled={isMinting || !isConnected}
                      className="px-8 py-3 bg-white text-black hover:bg-emerald-400 disabled:opacity-50 rounded-full font-bold transition-all flex items-center justify-center gap-2 mx-auto shadow-xl"
                    >
                      {isMinting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Minting on-chain...
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4" />
                          {isConnected ? "Mint Lineage as Genesis NFT (Etherlink)" : "Connect Wallet to Mint"}
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 block">Powered by Etherlink (500ms finality)</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-24">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-lg tracking-tighter italic">mederu AI</span>
            </div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">© 2026 AUTONOMOUS ART LAB</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Powered by mederu + Tezos block chain</p>
          </div>
          
          <div className="flex gap-8 text-xs text-zinc-500 uppercase font-bold tracking-[0.2em]">
            <a href="https://x.com/mederu_art" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X / Twitter</a>
            <a href="https://www.instagram.com/mederu.art/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
            <a href="https://tezos.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Tezos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
