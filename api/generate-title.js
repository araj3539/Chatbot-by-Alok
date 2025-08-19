// File: /api/generate-title.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('API key is not configured.');
    }

    // This uses the standard, non-streaming endpoint
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Optional: Add generation config for safety and consistency
      generation_config: {
        "temperature": 0.2,
        "max_output_tokens": 20,
      }
    };

    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      throw new Error(errorData.error.message || 'Failed to fetch from Google API');
    }

    const data = await googleResponse.json();
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
