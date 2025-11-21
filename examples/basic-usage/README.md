# Cencori SDK - Basic Usage Example

This example demonstrates how to use the Cencori SDK to make AI requests.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your API key:**
   Create a `.env` file:
   ```
   CENCORI_API_KEY=your_api_key_here
   ```

   Get your API key from: https://cencori.com/dashboard

3. **Run the example:**
   ```bash
   npm start
   ```

## What This Example Does

- Initializes the Cencori client with your API key
- Sends a chat message to the AI
- Displays the response and usage statistics
- Handles errors (authentication, rate limits, safety violations)

## Expected Output

```
🚀 Sending request to Cencori AI...

✅ Response received!

📝 Content: Cencori is an AI infrastructure platform...
📊 Usage Stats:
   - Prompt tokens: 15
   - Completion tokens: 25
   - Total tokens: 40
```

## Next Steps

Try modifying the example to:
- Send different prompts
- Adjust the temperature parameter
- Handle conversation history with multiple messages
