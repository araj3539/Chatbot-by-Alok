// This is the new, dedicated API for generating chat titles.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!history || history.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required.' });
    }

    const conversationForTitle = history.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
    const prompt = `Based on the following conversation, create a short, concise title (2-4 words maximum). The title should be about the main subject. Do not include "AI Tutor", "Chatbot", or use quotes. Just return the title text.\n\nConversation:\n${conversationForTitle}`;

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

    const geminiReqPayload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      system_instruction: {
        role: 'system',
        parts: [{ text: 'You are an expert at creating concise, relevant titles for conversations.' }]
      }
    };

    const geminiRes = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiReqPayload),
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json();
      throw new Error(errorData.error.message || `Gemini API error! status: ${geminiRes.status}`);
    }

    const result = await geminiRes.json();
    const newTitle = result.candidates?.[0]?.content?.parts?.[0]?.text || "New Chat";

    res.status(200).json({ title: newTitle.trim().replace(/"/g, '') });

  } catch (error) {
    console.error("Error in rename-chat handler:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred." });
  }
}