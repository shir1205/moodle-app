import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini client instance
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Unified AI generation endpoint
app.post('/api/ai/generate', async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt parameter' });
  }

  if (!ai && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured on server',
      fallbackRequired: true,
      userMessage: 'שירות ה-AI עמוס כרגע, ניתן לצפות בנתוני הגרפים ולנסות שוב בעוד מספר דקות',
    });
  }

  try {
    const client = ai || new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'אתה עוזר פדגוגי ומומחה אקדמי של מערכת CampuScope. השב תמיד בעברית רהוטה, מקצועית ומעודדת לסטודנטים ולמרצים.',
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    return res.json({ text });
  } catch (error: any) {
    console.error('Gemini API Error on server:', error?.message || error);
    return res.status(503).json({
      error: error?.message || 'Gemini service error',
      fallbackRequired: true,
      userMessage: 'שירות ה-AI עמוס כרגע, ניתן לצפות בנתוני הגרפים ולנסות שוב בעוד מספר דקות',
    });
  }
});

// AI Chat endpoint with conversation history
app.post('/api/ai/chat', async (req, res) => {
  const { messages, courseContext } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }

  if (!ai && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured on server',
      fallbackRequired: true,
      userMessage: 'שירות ה-AI עמוס כרגע, ניתן לצפות בנתוני הגרפים ולנסות שוב בעוד מספר דקות',
    });
  }

  try {
    const client = ai || new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextHeader = courseContext ? `הקשר הקורס הנוכחי: ${courseContext}\n` : '';
    const formattedPrompt = `${contextHeader}היסטוריית שיחה:\n` +
      messages.map((m: { role: string; content: string }) => `${m.role === 'user' ? 'סטודנט' : 'עוזר AI'}: ${m.content}`).join('\n') +
      `\nענה להודעה האחרונה בעברית ברורה ומדויקת, עם הסברים מובנים ודוגמאות אם רלוונטי.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedPrompt,
      config: {
        systemInstruction: 'אתה עוזר הוראה אישי חכם בקורס אקדמי ב-CampuScope. עזור לסטודנטים להבין מושגים מורכבים, שאלות הכנה ומטלות.',
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    return res.json({ reply: text });
  } catch (error: any) {
    console.error('Gemini Chat API Error:', error?.message || error);
    return res.status(503).json({
      error: error?.message || 'Gemini service error',
      fallbackRequired: true,
      userMessage: 'שירות ה-AI עמוס כרגע, ניתן לצפות בנתוני הגרפים ולנסות שוב בעוד מספר דקות',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Configure Vite middleware for development or serve dist for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CampuScope server running on http://0.0.0.0:${port}`);
  });
}

startServer();
