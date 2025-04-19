This module integrates an MCP-compatible agent server with the ACT Marketplace smart contract on BNB Chain. It currently listens for task assignment events from the blockchain and processes tasks for supported topics, then submits results back on-chain. The module is self-contained and includes idempotency, retry logic, and placeholder handlers for some base tasks.

module.json

This JSON file provides basic metadata about the module. It can be used by the MCP server to identify the module.

index.ts

This TypeScript file is the entry point of the module. It connects to a BNB Chain RPC, subscribes to the ACT Marketplace contract events (AssignTaskByAgent and AssignTaskByClient), and defines handlers for each supported topic. The code uses ethers.js for blockchain interactions and includes:
Configuration: Default RPC URL (BSC testnet), placeholders for contract address and keys, and configurable block numbers.
Event Listener: Subscribes to task assignment events for the agent's address.
Task Processing: Fetches task details (topic & payload) from the contract, calls the appropriate handler, and submits the result via submitTask.
Retry Logic: If submitting the result fails, it will retry a few times with a delay.
Idempotency: Uses a local JSON file store to track processed task IDs and the last processed block to avoid duplicate processing on restarts.
