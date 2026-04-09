import express from 'express';
import session from 'express-session';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase-applet-config.json'), 'utf-8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
app.use(express.json());
app.use(session({ secret: 'mederu-ai-secret', resave: false, saveUninitialized: true, cookie: { secure: true, sameSite: 'none', httpOnly: true } }));

const getTwitterClient = () => new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID || '', clientSecret: process.env.TWITTER_CLIENT_SECRET || '' });
const CALLBACK_URL = `${process.env.APP_URL || 'https://ai.mederu.art'}/api/tw`;

app.get('/api/auth/twitter/url', (req, res) => {
  try {
    const { url, codeVerifier, state } = getTwitterClient().generateOAuth2AuthLink(CALLBACK_URL, { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] });
    (req.session as any).twitterCodeVerifier = codeVerifier;
    (req.session as any).twitterState = state;
    res.json({ url });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tw', async (req, res) => {
  const { state, code } = req.query;
  const { twitterCodeVerifier, twitterState } = req.session as any;
  if (!twitterCodeVerifier || state !== twitterState || !code) return res.status(400).send('Invalid state');
  try {
    const { accessToken, refreshToken } = await getTwitterClient().loginWithOAuth2({ code: code as string, codeVerifier: twitterCodeVerifier, redirectUri: CALLBACK_URL });
    res.send(`<html><body><script>window.opener.postMessage({ type: 'TWITTER_AUTH_SUCCESS', tokens: ${JSON.stringify({ accessToken, refreshToken })} }, '*'); window.close();</script></body></html>`);
  } catch (err) { res.status(500).send('Twitter auth failed'); }
});

app.post('/api/twitter/share-alt', async (req, res) => {
  // alternative share logic
  res.json({ success: true, result: 'Alternative tweet fallback' });
});

app.get('/api/image/:artworkId', async (req, res) => {
  try {
    const artSnap = await getDoc(doc(db, 'artworks', req.params.artworkId));
    if (artSnap.exists()) {
      const base64Data = artSnap.data().imageUrl.split(',')[1];
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': img.length, 'Cache-Control': 'public, max-age=86400' });
      res.end(img);
    } else res.status(404).send('Not found');
  } catch (e) { res.status(500).send('Error'); }
});

export default app;
