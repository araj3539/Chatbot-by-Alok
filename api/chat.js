// File: /api/chat.js (Final Version with Timezone Conversion)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { history, systemInstruction } = req.body;
  const userQuery = history[history.length - 1].parts[0].text;
  const lowerCaseQuery = userQuery.toLowerCase();

  const webSearchKeywords = ['who is', 'what is', 'latest', 'current', 'news', 'president', 'election'];
  
  const requiresWebSearch = webSearchKeywords.some(keyword => lowerCaseQuery.includes(keyword));
  const isHistoricalQuery = lowerCaseQuery.includes('was') || lowerCaseQuery.includes('past') || lowerCaseQuery.includes('history');
  
  // --- Upgraded Smart Handler with Timezone Conversion ---
  const isPotentialTimeQuery = lowerCaseQuery.includes('time');
  const isPotentialDateQuery = lowerCaseQuery.includes('date') || lowerCaseQuery.includes('day') || lowerCaseQuery.includes('today');

  if ((isPotentialDateQuery || isPotentialTimeQuery) && !requiresWebSearch && !isHistoricalQuery) {
    const now = new Date();
    let responseText = '';
    const options = { timeZone: 'Asia/Kolkata' }; // Set timezone to India

    if (isPotentialTimeQuery) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        const formattedTime = now.toLocaleTimeString('en-US', options);
        responseText = `The current time in India is ${formattedTime}.`;
    } else {
        options.weekday = 'long';
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        const formattedDate = now.toLocaleDateString('en-US', options);
        responseText = `Today is ${formattedDate}.`;
    }

    return res.status(200).json({
      candidates: [{ content: { parts: [{ text: responseText }] } }]
    });
  }
  // --- END of new handler ---


  // --- Web Search Logic for other queries ---
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;

  let searchResultsContext = '';

  if (requiresWebSearch && searchApiKey && searchEngineId) {
    try {
      const refinedQuery = `what is the current ${userQuery}`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(refinedQuery)}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          searchResultsContext = searchData.items.slice(0, 5).map(item => item.snippet).join("\n---\n");
        }
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }
  
  if (searchResultsContext) {
      history.pop();
      const newPrompt = 
        `You are a fact-checking AI assistant. Your task is to analyze the following web search snippets and synthesize a single, direct, and accurate answer to the user's question. ` +
        `Do not describe the snippets or mention that the information is contradictory. Pick the most likely correct answer from the context provided.\n\n` +
        `[Web Search Snippets]:\n${searchResultsContext}\n\n` +
        `[User's Original Question]:\n${userQuery}\n\n` +
        `[Synthesized Answer]:`;
      history.push({ role: "user", parts: [{ text: newPrompt }] });
  }

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

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