
import os
from cencori import Cencori

def main():
    # Initialize client
    api_key = os.environ.get("CENCORI_API_KEY")
    if not api_key:
        print("Please set CENCORI_API_KEY environment variable")
        return

    client = Cencori(api_key=api_key)
    print("🚀 Initialized Cencori client")

    # 1. Chat Completion
    print("\n--- Chat Completion ---")
    response = client.ai.chat(
        messages=[{"role": "user", "content": "Hello! say 'Cencori is awesome'"}],
        model="gpt-4o"
    )
    print(f"Response: {response.content}")

    # 2. Embeddings
    print("\n--- Embeddings ---")
    embedding = client.ai.embeddings(input="Cencori AI Infrastructure")
    print(f"Embedding generated (dim: {len(embedding.embeddings[0])})")

    # 3. Metrics
    print("\n--- Metrics ---")
    metrics = client.metrics.get(period="24h")
    print(f"Total Requests (24h): {metrics.requests.total}")

    print("\nCreate projects, API keys, and provider connections in the Cencori dashboard.")

if __name__ == "__main__":
    main()
