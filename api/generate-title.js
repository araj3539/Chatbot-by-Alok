// File: /api/generate-title.js

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { prompt } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('API key is not configured on Vercel.');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generation_config: {
                "temperature": 0.3,
                "max_output_tokens": 256, // Increased for a larger safety buffer
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

        // After fetching Google response
        const data = await googleResponse.json();
        console.debug(data);

        // Safe check to ensure text exists
        let safeResponse = data;
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            safeResponse = {
                candidates: [
                    { content: { parts: [{ text: "Chat" }] } }
                ]
            };
        }

        return new Response(JSON.stringify(safeResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });


    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
