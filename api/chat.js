// File: /api/chat.js

// This function tells Vercel to use the Edge runtime, which is faster and supports streaming.
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
    const { history, systemInstruction } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('API key is not configured.');
    }

    // Use the streaming endpoint by adding ":streamGenerateContent"
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:streamGenerateContent?key=${apiKey}&alt=sse`;

    const payload = {
      contents: history,
      system_instruction: systemInstruction,
    };

    // Make the fetch request to the Google API
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      throw new Error(errorData.error.message || 'Failed to fetch from Google API');
    }

    // Return the streaming response directly to the client
    return new Response(googleResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
