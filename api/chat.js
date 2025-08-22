// File: /api/chat.js (Updated to use the new web-search API)

// Helper function for making Gemini API calls
const callGemini = async (payload, geminiApiKey) => {
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { history, systemInstruction } = req.body;
    const userQuery = history[history.length - 1].parts[0].text;
    const lowerCaseQuery = userQuery.toLowerCase();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // --- Step 1: Quick check for simple time/date queries ---
    const isPotentialTimeQuery = lowerCaseQuery.includes('time');
    const isPotentialDateQuery = lowerCaseQuery.includes('date') || lowerCaseQuery.includes('day') || lowerCaseQuery.includes('today');

    if ((isPotentialDateQuery || isPotentialTimeQuery)) {
        const now = new Date();
        let responseText = '';
        const options = { timeZone: 'Asia/Kolkata' };

        if (isPotentialTimeQuery) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
            responseText = `The current time in India is ${now.toLocaleTimeString('en-US', options)}.`;
        } else {
            options.weekday = 'long';
            options.year = 'numeric';
            options.month = 'long';
            options.day = 'numeric';
            responseText = `Today is ${now.toLocaleDateString('en-US', options)}.`;
        }
        return res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });
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
        const analyzerResponse = await callGemini(analyzerPayload, geminiApiKey);
        if (analyzerResponse.candidates[0]?.content?.parts[0]?.text.trim().toUpperCase() === 'YES') {
            requiresWebSearch = true;
        }
    } catch (error) {
        console.error("Error in AI query analyzer:", error);
        requiresWebSearch = false; // Default to not searching if analyzer fails
    }

    // --- Step 3: Call the new Web Search API if needed ---
    let searchResultsContext = '';
    if (requiresWebSearch) {
        try {
            // Construct the full URL for the web-search API
            const vercelUrl = process.env.VERCEL_URL || 'localhost:3000';
            const protocol = vercelUrl.startsWith('localhost') ? 'http' : 'https';
            const searchApiUrl = `${protocol}://${vercelUrl}/api/web-search`;

            const searchResponse = await fetch(searchApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery })
            });
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                searchResultsContext = searchData.context;
            }
        } catch (error) {
            console.error("Error calling web-search API:", error);
        }
    }

    // --- Step 4: Generate the final response ---
    let finalHistory = [...history];
    if (searchResultsContext) {
        finalHistory.pop(); // Remove the original user query
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
        const data = await callGemini(finalPayload, geminiApiKey);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
