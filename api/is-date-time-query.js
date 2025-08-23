// File: /api/is-date-time-query.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { query } = req.body;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!query) {
            return res.status(400).json({ error: 'Query is required.' });
        }

        // This specialized prompt asks the model to act as a classifier
        const systemInstruction = {
            role: "system",
            parts: [{
                text: "You are a query classifier. Your sole purpose is to determine if a user's question is asking for the *current* local date, day, or time. Respond with only a single word: 'Yes' or 'No'. Do not provide any explanations. For example, 'what time is it?' is 'Yes'. 'What is the date for Thanksgiving?' is 'No'."
            }]
        };

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: query }] }],
            system_instruction: systemInstruction
        };

        const geminiRes = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiRes.ok) {
            const errorData = await geminiRes.json();
            throw new Error(errorData.error.message || `Gemini API error! status: ${geminiRes.status}`);
        }

        const result = await geminiRes.json();
        const classification = result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "No";

        // We send back the classification in a JSON object
        res.status(200).json({ isDateTimeQuery: classification });

    } catch (error) {
        console.error("Error in is-date-time-query handler:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
}