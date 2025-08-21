// File: /api/chat.js (Final, Clean Version)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { history, systemInstruction } = req.body;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;
  
  const userQuery = history[history.length - 1].parts[0].text;

  // Keywords that suggest a need for recent information
  const keywords = ['who is', 'what is', 'latest', 'current', 'news', 'president', 'election', 'date', 'time', 'today'];
  const needsSearch = keywords.some(keyword => userQuery.toLowerCase().includes(keyword));

  let searchResultsContext = '';

  if (needsSearch && searchApiKey && searchEngineId) {
    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(userQuery)}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          searchResultsContext = "Based on a web search, here is some relevant information:\n\n";
          searchData.items.slice(0, 3).forEach(item => { // Get top 3 results
            searchResultsContext += `Title: ${item.title}\nSnippet: ${item.snippet}\n\n`;
          });
        }
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
      // Silently fail and let Gemini answer without search context if something goes wrong.
    }
  }

  // Prepend search context to the last user message if available
  if (searchResultsContext) {
      history[history.length - 1].parts[0].text = `${searchResultsContext}\nPlease use the information above to answer the following question: ${userQuery}`;
  }

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

  try {
    const payload = {
      contents: history,
      system_instruction: systemInstruction,
    };

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