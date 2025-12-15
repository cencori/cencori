import { Cencori, AuthenticationError, RateLimitError, SafetyError } from 'cencori';
import 'dotenv/config';

// Initialize the Cencori client
const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY
});

async function main() {
  try {
    console.log('🚀 Sending request to Cencori AI...\n');

    // Send a chat message
    const response = await cencori.ai.chat({
      messages: [
        { role: 'user', content: 'Explain what Cencori is in one sentence.' }
      ],
      temperature: 0.7
    });

    console.log('✅ Response received!\n');
    console.log('📝 Content:', response.content);
    console.log('\n📊 Usage Stats:');
    console.log('   - Prompt tokens:', response.usage.prompt_tokens);
    console.log('   - Completion tokens:', response.usage.completion_tokens);
    console.log('   - Total tokens:', response.usage.total_tokens);

  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed. Check your API key.');
    } else if (error instanceof RateLimitError) {
      console.error('⏱️  Rate limit exceeded. Please try again later.');
    } else if (error instanceof SafetyError) {
      console.error('🛡️  Content safety violation:', error.reasons);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

main();
