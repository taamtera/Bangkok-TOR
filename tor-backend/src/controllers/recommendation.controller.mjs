export async function list(request, response) {
  // Reserved for the separate AI suitability stage. A rules-based coverage
  // result must never be returned under the guise of an AI recommendation.
  response.json({ resultType: 'ai_recommendation', status: 'not_configured', items: [],
    message: 'AI project recommendations are not available yet. You can view your requirement matches now.' });
}
