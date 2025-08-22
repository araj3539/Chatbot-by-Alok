// File: /api/web-search.js

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

    const { query } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.SEARCH_ENGINE_ID;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required.' });
    }

    if (!searchApiKey || !searchEngineId) {
        return res.status(500).json({ error: 'Search API keys are not configured.' });
    }

    try {
        // Step 1: Generate a better search query using the AI
        const queryGenerationSystemInstruction = {
            role: "system",
            parts: [{ text: "You are an expert at crafting effective Google search queries. Based on the user's prompt, generate a concise and relevant search query that will find the most accurate and up-to-date information. Return only the search query text." }]
        };
        const queryGenerationPayload = {
            contents: [{ role: 'user', parts: [{ text: query }] }],
            system_instruction: queryGenerationSystemInstruction
        };
        const queryGenerationResponse = await callGemini(queryGenerationPayload, geminiApiKey);
        const generatedQuery = queryGenerationResponse.candidates[0]?.content?.parts[0]?.text.trim() || query;

        // Step 2: Perform the web search with the generated query
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(generatedQuery)}`;
        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
            throw new Error('Failed to fetch search results.');
        }

        const searchData = await searchResponse.json();
        let searchResultsContext = '';
        if (searchData.items && searchData.items.length > 0) {
            searchResultsContext = searchData.items.slice(0, 5).map(item => item.snippet).join("\n---\n");
        }

        // Step 3: Return the formatted search snippets
        res.status(200).json({ context: searchResultsContext });

    } catch (error) {
        console.error("Error in web-search handler:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred during web search." });
    }
}
