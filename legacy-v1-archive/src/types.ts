export interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prompt: string;
  creatorId: string;
  createdAt: string;
  style: string;
  likedBy?: string[];
  source?: 'studio' | 'alchemist' | 'autonomous';
}

export interface CuratedPost {
  id: string;
  source: string;
  content: string;
  imageUrl?: string;
  curatorComment: string;
  createdAt: string;
}

export interface AlchemistResult {
  id: string;
  url: string;
  dna: string;
  interpretation: string;
  artwork: Artwork;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
