// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract AgentRunReceipts {
    event AgentRunRecorded(
        bytes32 indexed receiptHash,
        string indexed externalRunId,
        address indexed recorder,
        string receiptURI
    );

    function recordRun(
        bytes32 receiptHash,
        string calldata externalRunId,
        string calldata receiptURI
    ) external {
        emit AgentRunRecorded(receiptHash, externalRunId, msg.sender, receiptURI);
    }
}
