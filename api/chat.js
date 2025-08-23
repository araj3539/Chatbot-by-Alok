// File: /api/chat.js (Refactored with a single "Router" model call)

// Helper function remains the same
const callGemini = async (payload, geminiApiKey) => {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
    // Adding a safety setting to encourage JSON output
    const safetySettings = [{
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_NONE"
    }];
    const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, safetySettings }),
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
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // --- Step 1: The "Router" Call ---
    // This single call decides what action to take next.
    const routerSystemInstruction = {
        role: "system",
        parts: [{
            text: `You are an intelligent routing agent. Your task is to analyze the user's query and decide which tool is appropriate to answer it.
You must respond in a valid JSON format with a single key "tool_to_use".
The possible values for "tool_to_use" are:
1. "date_time_query": If the user is asking for the current date, day, or time.
2. "web_search": If the query requires real-time, up-to-date information from the internet (e.g., current events, recent data, specific people, news).
3. "general_conversation": For all other queries, including general knowledge, concepts, history, or creative tasks.

Examples:
- User: "what time is it now?" -> {"tool_to_use": "date_time_query"}
- User: "who is the current prime minister of France?" -> {"tool_to_use": "web_search"}
- User: "explain linked lists" -> {"tool_to_use": "general_conversation"}

Respond ONLY with the JSON object.`
        }]
    };

    let selectedTool = 'general_conversation'; // Default tool
    try {
        const routerPayload = {
            contents: [{ role: 'user', parts: [{ text: userQuery }] }],
            system_instruction: routerSystemInstruction,
        };
        const routerResponse = await callGemini(routerPayload, geminiApiKey);
        const routerResultText = routerResponse.candidates[0]?.content?.parts[0]?.text.trim();
        
        // Clean and parse the JSON response from the model
        const jsonResponse = JSON.parse(routerResultText.replace(/```json|```/g, ''));
        selectedTool = jsonResponse.tool_to_use;

    } catch (error) {
        console.error("Error in Router Call:", error);
        // If the router fails, we default to a general conversation to ensure the user gets a response.
        selectedTool = 'general_conversation';
    }


    // --- Step 2: Execute Action Based on the Router's Decision ---
    try {
        switch (selectedTool) {
            case 'date_time_query':
                const now = new Date();
                const options = { timeZone: 'Asia/Kolkata', hour12: true };
                let responseText = '';
                if (userQuery.toLowerCase().includes('time')) {
                    options.hour = '2-digit';
                    options.minute = '2-digit';
                    responseText = `The current time is ${now.toLocaleTimeString('en-US', options)}.`;
                } else {
                    options.weekday = 'long';
                    options.year = 'numeric';
                    options.month = 'long';
                    options.day = 'numeric';
                    responseText = `Today is ${now.toLocaleDateString('en-US', options)}.`;
                }
                return res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });

            case 'web_search':
                let searchResultsContext = '';
                const host = req.headers['x-forwarded-host'] || req.headers['host'];
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const searchApiUrl = `${protocol}://${host}/api/web-search`;

                const searchResponse = await fetch(searchApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: userQuery })
                });

                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    searchResultsContext = searchData.context;
                }
                
                // Now, synthesize the final answer using the search context
                const newPrompt =
                    `You are a helpful AI assistant. Synthesize a single, concise, and accurate answer to the user's question using the provided web search snippets as your primary source. Provide the answer directly as if you already knew it.\n\n` +
                    `[Web Search Snippets]:\n${searchResultsContext}\n\n` +
                    `[User's Original Question]:\n${userQuery}\n\n` +
                    `[Final Answer]:`;

                const finalHistory = [...history.slice(0, -1), { role: "user", parts: [{ text: newPrompt }] }];
                const finalPayload = { contents: finalHistory, system_instruction: systemInstruction };
                const data = await callGemini(finalPayload, geminiApiKey);
                return res.status(200).json(data);

            case 'general_conversation':
            default:
                // If no special tool is needed, just get a direct response
                const generalPayload = { contents: history, system_instruction: systemInstruction };
                const generalData = await callGemini(generalPayload, geminiApiKey);
                return res.status(200).json(generalData);
        }
    } catch (error) {
        console.error("Error in main handler:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred." });
    }
}