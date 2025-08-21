// File: /api/chat.js (Forced Search Debugging Version)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { history, systemInstruction } = req.body;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;
  
  const userQuery = history[history.length - 1].parts[0].text;
  let searchResultsContext = '';

  // --- THIS IS THE CHANGE ---
  // We are forcing the search to run on every message for this test.
  if (true) {
    try {
      if (!searchApiKey || !searchEngineId) {
        throw new Error("Search API Key or Search Engine ID is missing.");
      }
      
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(userQuery)}`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        const errorBody = await searchResponse.json();
        throw new Error(`Google Search API Error: ${JSON.stringify(errorBody)}`);
      }
      
      const searchData = await searchResponse.json();
      if (searchData.items && searchData.items.length > 0) {
        searchResultsContext = "Based on a web search, here is some relevant information:\n\n";
        searchData.items.slice(0, 3).forEach(item => {
          searchResultsContext += `Title: ${item.title}\nSnippet: ${item.snippet}\n\n`;
        });
      }
    } catch (error) {
      // If the forced search fails, we MUST see an error in the chat.
      return res.status(200).json({
        candidates: [{
          content: { parts: [{ text: `**FORCED SEARCH FAILED**: ${error.message}` }] }
        }]
      });
    }
  }

  if (searchResultsContext) {
      history[history.length - 1].parts[0].text = `${searchResultsContext}\nPlease use the information above to answer the following question: ${userQuery}`;
  } else {
      // If the forced search ran but found nothing, send a message.
      history.push({ role: "model", parts: [{ text: "**DEBUGGING**: I performed a forced web search but found no results. Answering from my base knowledge." }] });
  }

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

  try {
    const payload = { contents: history, system_instruction: systemInstruction };
    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.error.message });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}