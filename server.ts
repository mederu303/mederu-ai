import express from "express";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Load .env.local first (contains API keys), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase for server-side use
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(
    session({
      secret: "mederu-ai-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      },
    })
  );

  // Twitter OAuth 2.0 Config
  const getTwitterClient = () => {
    return new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
    });
  };

  const CALLBACK_URL = `${process.env.APP_URL || "http://localhost:3000"}/tw`;

  // 1. Get Twitter Auth URL
  app.get("/api/auth/twitter/url", (req, res) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Twitter API credentials missing in environment variables.");
      return res.status(500).json({ error: "Twitter API credentials not configured. Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in Secrets." });
    }

    try {
      const client = getTwitterClient();
      console.log("Generating Twitter OAuth link with callback:", CALLBACK_URL);
      
      const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
        CALLBACK_URL,
        { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
      );

      if (!url) {
        throw new Error("Twitter API failed to generate an authorization URL.");
      }

      // Store verifier and state in session
      (req.session as any).twitterCodeVerifier = codeVerifier;
      (req.session as any).twitterState = state;

      console.log("Generated Twitter Auth URL:", url);
      res.json({ url });
    } catch (error: any) {
      console.error("Twitter Auth URL Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate Twitter auth URL" });
    }
  });

  // 2. Twitter Callback
  app.get("/tw", async (req, res) => {
    const { state, code } = req.query;
    const { twitterCodeVerifier, twitterState } = req.session as any;

    if (!twitterCodeVerifier || state !== twitterState || !code) {
      return res.status(400).send("Invalid request or state mismatch");
    }

    try {
      const client = getTwitterClient();
      const {
        client: loggedClient,
        accessToken,
        refreshToken,
      } = await client.loginWithOAuth2({
        code: code as string,
        codeVerifier: twitterCodeVerifier,
        redirectUri: CALLBACK_URL,
      });

      // In a real app, you'd save these to Firestore associated with the user
      // For this demo, we'll send a success message to the opener
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'TWITTER_AUTH_SUCCESS',
                tokens: ${JSON.stringify({ accessToken, refreshToken })}
              }, '*');
              window.close();
            </script>
            <p>Twitter connected! Closing window...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Twitter Callback Error:", error);
      res.status(500).send("Twitter authentication failed");
    }
  });

  // 3. Post Tweet
  app.post("/api/twitter/tweet", async (req, res) => {
    const { text, accessToken, artworkId } = req.body;

    if (!accessToken) {
      return res.status(401).json({ error: "No Twitter access token provided" });
    }

    try {
      const userClient = new TwitterApi(accessToken);
      let mediaIds: string[] = [];

      if (artworkId) {
        try {
          const artRef = doc(db, "artworks", artworkId);
          const artSnap = await getDoc(artRef);
          if (artSnap.exists()) {
            const data = artSnap.data();
            const base64Data = data.imageUrl.split(",")[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            
            // Upload media (v1.1 endpoint is used for media upload even for v2 tweets)
            const mediaId = await userClient.v1.uploadMedia(imgBuffer, { mimeType: 'image/jpeg' });
            mediaIds.push(mediaId);
          }
        } catch (mediaErr) {
          console.error("Media Upload Error:", mediaErr);
          // Continue without media if upload fails
        }
      }

      const tweetPayload: any = { text };
      if (mediaIds.length > 0) {
        tweetPayload.media = { media_ids: mediaIds };
      }

      const { data: createdTweet } = await userClient.v2.tweet(tweetPayload);
      res.json({ success: true, tweet: createdTweet });
    } catch (error) {
      console.error("Tweet Error:", error);
      res.status(500).json({ error: "Failed to post tweet" });
    }
  });

  // 3b. Alternative Twitter Share (RapidAPI)
  app.post("/api/twitter/share-alt", async (req, res) => {
    const { text, artworkId } = req.body;
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    if (!apiKey || !apiHost) {
      return res.status(500).json({ error: "RapidAPI configuration missing. Please set RAPIDAPI_KEY and RAPIDAPI_HOST." });
    }

    try {
      // Construct the share URL
      const shareUrl = `${appUrl}/share/${artworkId}`;
      const fullText = `${text}\n\n${shareUrl}`;

      // Recommended API: "Twitter API by Giga" (twitter-api45.p.rapidapi.com)
      // Endpoint: POST /create_tweet
      const response = await fetch(`https://${apiHost}/create_tweet`, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': apiHost,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: fullText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "RapidAPI request failed");
      }

      const result = await response.json();
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("RapidAPI Tweet Error:", error);
      res.status(500).json({ error: error.message || "Failed to post via alternative API" });
    }
  });

  // 4. Share Page (for Twitter Cards)
  app.get("/share/:artworkId", async (req, res) => {
    const { artworkId } = req.params;
    // Use APP_URL if set, otherwise derive from request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const appUrl = process.env.APP_URL || `${protocol}://${host}`;
    
    try {
      const artRef = doc(db, "artworks", artworkId);
      const artSnap = await getDoc(artRef);
      const artData = artSnap.exists() ? artSnap.data() : null;
      
      const title = artData ? artData.title : "mederu AI Artwork";
      const description = artData ? artData.description : "Generated by mederu AI";
      const imageUrl = `${appUrl}/api/image/${artworkId}`;

      const html = `
        <!DOCTYPE html>
        <html lang="ja">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${title} | mederu AI</title>
            
            <!-- Twitter Card -->
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:site" content="@mederu_art">
            <meta name="twitter:creator" content="@mederu_art">
            <meta name="twitter:title" content="${title}">
            <meta name="twitter:description" content="${description}">
            <meta name="twitter:image" content="${imageUrl}">
            
            <!-- Open Graph -->
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:image:secure_url" content="${imageUrl}">
            <meta property="og:image:type" content="image/jpeg">
            <meta property="og:image:width" content="1024">
            <meta property="og:image:height" content="1024">
            <meta property="og:url" content="${appUrl}/share/${artworkId}">
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="mederu AI">

            <style>
              body {
                background: #000;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
                box-sizing: border-box;
                text-align: center;
              }
              .container {
                max-width: 800px;
                width: 100%;
                animation: fadeIn 1s ease-out;
              }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .artwork-container {
                position: relative;
                width: 100%;
                aspect-ratio: 1/1;
                background: #111;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 32px;
              }
              .artwork-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              h1 {
                font-size: 2rem;
                font-weight: 900;
                font-style: italic;
                letter-spacing: -0.05em;
                text-transform: uppercase;
                margin: 0 0 8px 0;
              }
              .description {
                color: #a1a1aa;
                font-size: 0.9rem;
                line-height: 1.6;
                max-width: 500px;
                margin: 0 auto 24px auto;
              }
              .badge {
                display: inline-block;
                padding: 4px 12px;
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                border-radius: 100px;
                margin-bottom: 16px;
              }
              .redirect-text {
                font-size: 12px;
                color: #52525b;
                text-transform: uppercase;
                letter-spacing: 0.2em;
                margin-top: 40px;
              }
              .loading-bar {
                width: 100px;
                height: 2px;
                background: #27272a;
                margin: 12px auto;
                position: relative;
                overflow: hidden;
              }
              .loading-progress {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 30%;
                background: #10b981;
                animation: loading 1.5s infinite ease-in-out;
              }
              @keyframes loading {
                0% { left: -30%; }
                100% { left: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="badge">mederu AI / Autonomous Art</div>
              <h1>${title}</h1>
              <p class="description">${description}</p>
              
              <div class="artwork-container">
                <img src="${imageUrl}" class="artwork-image" alt="${title}">
              </div>

              <div class="redirect-text">Redirecting to Gallery</div>
              <div class="loading-bar">
                <div class="loading-progress"></div>
              </div>
            </div>

            <script>
              setTimeout(() => {
                window.location.href = "/?art=${artworkId}";
              }, 3000);
            </script>
          </body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      console.error("Share Page Error:", error);
      res.status(500).send("Error generating share page");
    }
  });

  // 5. Image Proxy (to serve base64 as binary)
  app.get("/api/image/:artworkId", async (req, res) => {
    const { artworkId } = req.params;
    try {
      const artRef = doc(db, "artworks", artworkId);
      const artSnap = await getDoc(artRef);
      
      if (artSnap.exists()) {
        const data = artSnap.data();
        const base64Data = data.imageUrl.split(",")[1];
        const img = Buffer.from(base64Data, 'base64');
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': img.length,
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(img);
      } else {
        res.status(404).send("Image not found");
      }
    } catch (error) {
      console.error("Image Proxy Error:", error);
      res.status(500).send("Error fetching image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
