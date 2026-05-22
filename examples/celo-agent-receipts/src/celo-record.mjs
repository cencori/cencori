export async function recordReceiptOnCelo({
  rpcUrl,
  privateKey,
  contractAddress,
  receiptHash,
  externalRunId,
  receiptURI,
}) {
  if (!privateKey || !contractAddress) {
    return {
      simulated: true,
      txHash: null,
      message:
        "Missing CELO_PRIVATE_KEY or CELO_RECEIPTS_CONTRACT. Receipt generated locally but not recorded onchain.",
    };
  }

  const [{ createPublicClient, createWalletClient, http, parseAbi }, { privateKeyToAccount }, { celoSepolia }] =
    await Promise.all([
      import("viem"),
      import("viem/accounts"),
      import("viem/chains"),
    ]);

  const receiptsAbi = parseAbi([
    "function recordRun(bytes32 receiptHash,string externalRunId,string receiptURI)",
  ]);

  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey);
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport,
  });

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: receiptsAbi,
    functionName: "recordRun",
    args: [receiptHash, externalRunId, receiptURI],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    simulated: false,
    txHash,
    recorder: account.address,
  };
}
