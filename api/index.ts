import express from "express";
import { Client as WaveSpeed } from "wavespeed";

const app = express();

// Security Response Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Increase payload limit for large base64 images
app.use(express.json({ limit: '50mb' }));

// Helper to check if a hostname is private/internal (SSRF mitigation)
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  // Check private IP ranges
  if (/^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) {
    return true;
  }
  return false;
}

const router = express.Router();

// 1. Health check & key status
router.get("/health", (req, res) => {
  const customOpenRouter = req.headers['x-openrouter-key'];
  const customOpenAi = req.headers['x-openai-key'];
  const customWaveSpeed = req.headers['x-wavespeed-key'];

  res.json({ 
    status: "ok",
    keys: {
      OPENROUTER: !!(customOpenRouter || process.env.OPENROUTER_API_KEY || process.env.API_KEY),
      OPENAI: !!(customOpenAi || process.env.OPENAI_API_KEY),
      WAVESPEED: !!(customWaveSpeed || process.env.WAVESPEED_API_KEY)
    }
  });
});

// 2. OpenRouter completions proxy
router.post("/openrouter/chat/completions", async (req, res) => {
  try {
    const customKey = req.headers['x-openrouter-key'] as string;
    const apiKey = customKey || process.env.OPENROUTER_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: { message: "OPENROUTER_API_KEY is missing. Add it to .env or Netlify Environment Variables." } });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aistudio.google.com",
        "X-Title": "Clips Video Production Pipeline",
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error("OpenRouter Proxy Error:", error);
    res.status(500).json({ error: { message: error.message } });
  }
});

// 3. OpenAI TTS Proxy
router.post("/openai/audio/speech", async (req, res) => {
  try {
    const customKey = req.headers['x-openai-key'] as string;
    const apiKey = customKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: { message: "OPENAI_API_KEY is missing. Add it to .env or Netlify Environment Variables." } });
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).send(errorData);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (error: any) {
    console.error("OpenAI Proxy Error:", error);
    res.status(500).json({ error: { message: error.message } });
  }
});

// 4. Wavespeed Image Proxy
router.post("/wavespeed/image", async (req, res) => {
  try {
    const customKey = req.headers['x-wavespeed-key'] as string;
    const apiKey = customKey || process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "WAVESPEED_API_KEY is missing. Add it to .env or Netlify Environment Variables." });
    }

    const client = new WaveSpeed(apiKey);

    const { prompt, aspect_ratio } = req.body;

    const result = await client.run("wavespeed-ai/flux-schnell", {
      prompt,
      aspect_ratio,
      num_images: 1
    });

    if (result && result.outputs && result.outputs.length > 0) {
      return res.json({ output: result.outputs[0] });
    }
    
    res.status(500).json({ error: result.error || "No output from Wavespeed" });
  } catch (error: any) {
    console.error("Wavespeed Image Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Wavespeed Video Proxy
router.post("/wavespeed/video", async (req, res) => {
  try {
    const customKey = req.headers['x-wavespeed-key'] as string;
    const apiKey = customKey || process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "WAVESPEED_API_KEY is missing. Add it to .env or Netlify Environment Variables." });
    }

    const client = new WaveSpeed(apiKey);

    const { prompt, image_url } = req.body;

    const result = await client.run("wavespeed-ai/wan-2.2/i2v-480p-ultra-fast", {
      prompt,
      image: image_url,
      duration: 5,
      seed: -1
    });

    if (result && result.outputs && result.outputs.length > 0) {
      return res.json({ output: result.outputs[0] });
    }
    
    res.status(500).json({ error: result.error || "No output from Wavespeed" });
  } catch (error: any) {
    console.error("Wavespeed Video Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Image Proxy for Downloading (with SSRF protection)
router.get("/proxy/image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing or invalid url parameter" });
    }

    // SSRF & Protocol validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: "Unsupported URL protocol" });
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return res.status(403).json({ error: "Access to private/internal network addresses is prohibited" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch image" });
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error("Image Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Support both /api/route (local dev / Vercel / Netlify with prefix) and /route (Netlify :splat rewrite)
app.use("/api", router);
app.use("/", router);

export default app;
