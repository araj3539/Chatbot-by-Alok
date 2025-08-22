// File: /api/chat.js (Final Version with AI-driven Web Search)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { history, systemInstruction } = req.body;
  const userQuery = history[history.length - 1].parts[0].text;
  const lowerCaseQuery = userQuery.toLowerCase();
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // --- Helper function for making Gemini API calls ---
  const callGemini = async (payload) => {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  // --- Step 1: Quick check for simple time/date queries (efficient) ---
  const isPotentialTimeQuery = lowerCaseQuery.includes('time');
  const isPotentialDateQuery = lowerCaseQuery.includes('date') || lowerCaseQuery.includes('day') || lowerCaseQuery.includes('today');

  if ((isPotentialDateQuery || isPotentialTimeQuery)) {
      console.debug("Datequery is running");
      const now = new Date();
      let responseText = '';
      // Set timezone to India Standard Time
      const options = { timeZone: 'Asia/Kolkata' }; 

      if (isPotentialTimeQuery) {
          options.hour = '2-digit';
          options.minute = '2-digit';
          options.second = '2-digit';
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

  // --- Step 2: AI-driven decision for web search ---
  let requiresWebSearch = false;
  try {
    const analyzerSystemInstruction = {
      role: "system",
      parts: [{ text: "You are a query analyzer. Your task is to determine if a user's prompt requires real-time, up-to-date information from the internet to be answered accurately. This includes topics like current events, recent data, specific people (like government officials), or the latest news. For general knowledge, concepts (like 'linked list'), or historical questions, an internet search is not needed. Respond with only a single word: 'YES' or 'NO'." }]
    };
    const analyzerPayload = {
      contents: [{ role: 'user', parts: [{ text: userQuery }] }],
      system_instruction: analyzerSystemInstruction
    };

    const analyzerResponse = await callGemini(analyzerPayload);
    const decision = analyzerResponse.candidates[0]?.content?.parts[0]?.text.trim().toUpperCase();
    if (decision === 'YES') {
      requiresWebSearch = true;
    }

  } catch (error) {
    console.error("Error in AI query analyzer:", error);
    // Default to not searching if the analyzer fails to prevent errors
    requiresWebSearch = false;
  }


  // --- Step 3: Perform Web Search if needed ---
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;
  let searchResultsContext = '';

  if (requiresWebSearch && searchApiKey && searchEngineId) {
    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(userQuery)}`;
      const searchResponse = await fetch(searchUrl);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          // Join the snippets from the search results to create a context block
          searchResultsContext = searchData.items.slice(0, 5).map(item => item.snippet).join("\n---\n");
        }
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }

  // --- Step 4: Generate the final response ---
  let finalHistory = [...history];
  if (searchResultsContext) {
      finalHistory.pop(); // Remove the original user query to replace it with the context-aware one
      const newPrompt =
        `You are a helpful AI assistant. Your task is to synthesize a single, concise, and accurate answer to the user's question using the provided web search snippets as your primary source of information. ` +
        `Do not mention that you are using snippets or search results. Just provide the answer directly and confidently as if you already knew it. ` +
        `If the information in the snippets is contradictory or insufficient to answer the question accurately, state that you couldn't find a definitive answer from the available information.\n\n` +
        `[Web Search Snippets]:\n${searchResultsContext}\n\n` +
        `[User's Original Question]:\n${userQuery}\n\n` +
        `[Final Answer]:`;
      finalHistory.push({ role: "user", parts: [{ text: newPrompt }] });
  }

  try {
    const finalPayload = { contents: finalHistory, system_instruction: systemInstruction };
    const data = await callGemini(finalPayload);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
