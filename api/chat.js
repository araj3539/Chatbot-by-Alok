// File: /api/chat.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history, systemInstruction } = req.body;
    // --- CORRECTED: Securely access the API key by its name ---
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('API key is not configured on Vercel.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: history,
      system_instruction: systemInstruction,
    };

    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      return res.status(googleResponse.status).json({ error: errorData.error.message });
    }

    const data = await googleResponse.json();
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
