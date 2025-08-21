// File: /api/test-search.js

export default async function handler(req, res) {
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;

  // Check 1: Are the environment variables present?
  if (!searchApiKey || !searchEngineId) {
    return res.status(500).json({ 
      error: "Environment variables GOOGLE_SEARCH_API_KEY or SEARCH_ENGINE_ID are missing.",
      hasSearchApiKey: !!searchApiKey,
      hasSearchEngineId: !!searchEngineId
    });
  }

  const query = "what is today's date";
  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;

  try {
    const searchResponse = await fetch(searchUrl);
    const responseData = await searchResponse.json();

    // Check 2: Did the API call succeed?
    if (!searchResponse.ok) {
      return res.status(searchResponse.status).json({
        error: "Google Search API returned an error.",
        details: responseData
      });
    }

    // Check 3: Did the search find any results?
    if (!responseData.items || responseData.items.length === 0) {
      return res.status(200).json({
        message: "The API call was successful, but the search returned 0 results. This might indicate a problem with the Search Engine ID or configuration.",
        apiResponse: responseData
      });
    }

    // If everything works, return the results
    return res.status(200).json({
      message: "SUCCESS: The Google Search API is working correctly.",
      top_result_title: responseData.items[0].title,
      top_result_snippet: responseData.items[0].snippet,
      full_response: responseData
    });

  } catch (error) {
    return res.status(500).json({ 
      error: "A critical error occurred while trying to fetch from the Google Search API.",
      errorMessage: error.message 
    });
  }
}