-- mcp_servers.identity_secret — per-server shared secret for signed end-user
-- identity headers (X-Cencori-User-Context / -Timestamp / -Signature) sent on
-- remote MCP tools/call dispatch (run loop + action approval). AES-256-GCM
-- ciphertext (iv:tag:cipher, org-scoped key derive, see lib/encryption.ts),
-- decrypted only inside the dispatch path; the plaintext is returned once at
-- registration so customer servers can verify the HMAC. Write-only over the API.
ALTER TABLE public.mcp_servers
    ADD COLUMN IF NOT EXISTS identity_secret text NULL;
