import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// --------------------------- Configuration --------------------------- //
// Default configuration values for local testing (to be adjusted in deployment).
const config = {
  // BNB Chain RPC (using BSC testnet by default for testing):
  rpcUrl: process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
  // ACT Marketplace contract address (placeholder, update when deployed):
  contractAddress: process.env.CONTRACT_ADDRESS || "0xYourMarketplaceContractAddress",
  // Agent's public address (the wallet that will handle tasks):
  agentAddress: process.env.PUBLIC_KEY || "0xYourAgentAddress",
  // Agent's private key (for signing transactions to submit results):
  agentPrivateKey: process.env.PRIVATE_KEY || "0xYourAgentPrivateKey",
  // Block number where the contract was deployed (to start event scanning):
  contractDeploymentBlock: process.env.CONTRACT_DEPLOYMENT_BLOCK 
                           ? Number(process.env.CONTRACT_DEPLOYMENT_BLOCK) 
                           : 0,
  // Last processed block (if known, otherwise will use deployment block):
  lastProcessedBlock: process.env.LAST_PROCESSED_BLOCK 
                      ? Number(process.env.LAST_PROCESSED_BLOCK) 
                      : 0
};

// ------------------------ Contract ABI & Setup ----------------------- //
// Minimal ABI: events and functions needed (AssignTask events, getTask, submitTask).
const marketplaceAbi = [
  "event AssignTaskByClient(uint256 indexed taskId, address indexed agent)",
  "event AssignTaskByAgent(uint256 indexed taskId, address indexed agent)",
  "function getTask(uint96 id) view returns (uint96 id, uint32 createdAtTs, uint32 submissionDuration, uint32 updatedAtTs, uint32 executionDuration, uint128 reward, uint128 validationReward, address owner, address assignedAgent, address validator, bytes32 topic, string payload, uint8 state)",
  "function submitTask(uint96 taskId, string result) external"
];

// Initialize ethers provider and wallet signer
const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
const wallet   = new ethers.Wallet(config.agentPrivateKey, provider);
const contract = new ethers.Contract(config.contractAddress, marketplaceAbi, wallet);

// ------------------------ Idempotency Store -------------------------- //
// Local store to keep track of processed tasks and last block.
// This helps ensure each task is processed only once.
const storeFilePath = path.join(__dirname, "processedTasks.json");
interface StoreData {
  lastProcessedBlock: number;
  processedTaskIds: string[];
}
let store: StoreData = { lastProcessedBlock: config.lastProcessedBlock, processedTaskIds: [] };

// Load existing store from file (if present)
try {
  const raw = fs.readFileSync(storeFilePath, "utf-8");
  const data: StoreData = JSON.parse(raw);
  if (data.lastProcessedBlock && data.lastProcessedBlock > store.lastProcessedBlock) {
    store.lastProcessedBlock = data.lastProcessedBlock;
  }
  if (Array.isArray(data.processedTaskIds)) {
    store.processedTaskIds = data.processedTaskIds;
  }
  console.log(`Loaded store: ${store.processedTaskIds.length} tasks processed previously, last block ${store.lastProcessedBlock}.`);
} catch (err) {
  console.log("No existing processedTasks.json found, starting fresh.");
}

// Helper to save store to file
function saveStore() {
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("Failed to write store file:", err);
  }
}

// ---------------------- Task Handlers for Topics --------------------- //
// Define handler functions for each supported topic. These are placeholders 
// and should be implemented with real logic (e.g., API calls) as needed.
async function handleTwitterTask(payload: string): Promise<any> {
  console.log(" [Twitter Handler] Processing Twitter task with payload:", payload);
  // TODO: Implement actual Twitter API interaction.
  // For example, if payload is a tweet message, post the tweet via Twitter API.
  // Here we simulate a result containing a tweet ID and URL.
  return {
    tweetId: "1234567890",
    url: "https://twitter.com/example/status/1234567890"
  };
}

async function handleInstagramTask(payload: string): Promise<any> {
  console.log(" [Instagram Handler] Processing Instagram task with payload:", payload);
  // TODO: Implement actual Instagram API interaction.
  // Simulate returning an Instagram post ID and URL.
  return {
    postId: "ABCDEF123456",
    url: "https://instagram.com/p/ABCDEF123456"
  };
}

async function handleTiktokTask(payload: string): Promise<any> {
  console.log(" [TikTok Handler] Processing TikTok task with payload:", payload);
  // TODO: Implement actual TikTok API interaction.
  // Simulate returning a TikTok video ID and URL.
  return {
    videoId: "999888777",
    url: "https://tiktok.com/@user/video/999888777"
  };
}

async function handleLinkedInTask(payload: string): Promise<any> {
  console.log(" [LinkedIn Handler] Processing LinkedIn task with payload:", payload);
  // TODO: Implement actual LinkedIn API interaction.
  // Simulate returning a LinkedIn post ID and URL.
  return {
    postId: "LINKEDIN-POST-12345",
    url: "https://linkedin.com/feed/update/LINKEDIN-POST-12345"
  };
}

// Map topic identifiers to handler functions
const topicHandlers: { [key: string]: (payload: string) => Promise<any> } = {
  "social_twitter":    handleTwitterTask,
  "social_instagram":  handleInstagramTask,
  "social_tiktok":     handleTiktokTask,
  "social_linkedin":   handleLinkedInTask
};

// ---------------------- Event Processing Logic ----------------------- //
// Helper to process a task assignment event. This fetches task data, runs the appropriate handler, and submits the result.
async function processTaskAssignment(taskId: ethers.BigNumber): Promise<void> {
  const taskIdStr = taskId.toString();
  // Idempotency check: skip if we already processed this task
  if (store.processedTaskIds.includes(taskIdStr)) {
    console.log(` [Info] Task ${taskIdStr} already processed. Skipping.`);
    return;
  }

  try {
    // Fetch task details from the contract
    const task = await contract.getTask(taskId);
    const assignedAgent: string = task.assignedAgent || task[8];
    const topicBytes: string = task.topic || task[10];
    const payload: string = task.payload || task[11];
    const state: number = task.state !== undefined ? task.state : task[12];
    
    // Ensure this task is assigned to us and in ASSIGNED state
    if (assignedAgent.toLowerCase() !== config.agentAddress.toLowerCase()) {
      console.log(` [Warning] Task ${taskIdStr} is not assigned to this agent. Ignoring.`);
      return;
    }
    // TaskState.ASSIGNED = 2 (from ActMarketLib.TaskState enum)
    if (state !== 2) {
      console.log(` [Warning] Task ${taskIdStr} is not in ASSIGNED state (state=${state}). Skipping processing.`);
      return;
    }

    // Decode topic name (bytes32 to string). If it fails, use the raw bytes as hex string.
    let topicName: string;
    try {
      topicName = ethers.utils.parseBytes32String(topicBytes);
    } catch {
      topicName = topicBytes;  // fallback to bytes hex representation
    }
    console.log(` [Event] New task assigned: ID=${taskIdStr}, Topic=${topicName}`);

    // Find appropriate handler for the topic
    const handler = topicHandlers[topicName];
    if (!handler) {
      console.error(` [Error] No handler available for topic "${topicName}".`);
      return;
    }

    // Process the task using the handler
    let resultData: any;
    let resultString: string;
    try {
      resultData = await handler(payload);
      // If handler returns an object, convert to JSON string; if string, use as-is
      resultString = (typeof resultData === "string") ? resultData : JSON.stringify(resultData);
    } catch (taskErr) {
      console.error(` [Error] Handler for topic ${topicName} failed:`, taskErr);
      // If the handler fails (e.g. API error), do not mark task as processed so it can be retried or handled manually.
      return;
    }

    console.log(` [Info] Task ${taskIdStr} processed. Submitting result...`);

    // Submit the result back to the blockchain
    await submitResultWithRetry(taskId, resultString);

    // Mark task as processed (idempotency) and save to store
    store.processedTaskIds.push(taskIdStr);
    saveStore();
    console.log(` [Success] Task ${taskIdStr} result submitted and recorded as processed.`);
  } catch (err) {
    console.error(` [Error] Unexpected failure processing task ${taskIdStr}:`, err);
    // (Do not add to processed list here, so it can be retried on next startup if needed)
  }
}

// Helper function to submit result with retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;  // 10 seconds
async function submitResultWithRetry(taskId: ethers.BigNumber, result: string, attempt: number = 1): Promise<void> {
  const taskIdStr = taskId.toString();
  try {
    const tx = await contract.submitTask(taskId, result);
    console.log(` [Info] submitTask txn sent (task ${taskIdStr}): ${tx.hash}`);
    await tx.wait();
    console.log(` [Info] submitTask txn confirmed for task ${taskIdStr}.`);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.warn(` [Warn] submitTask failed for task ${taskIdStr} (attempt ${attempt}). Retrying in ${RETRY_DELAY_MS/1000}s... Error:`, error);
      // Retry after a delay
      setTimeout(() => {
        submitResultWithRetry(taskId, result, attempt + 1);
      }, RETRY_DELAY_MS);
    } else {
      console.error(` [Error] Failed to submit result for task ${taskIdStr} after ${MAX_RETRIES} attempts. Error:`, error);
      // At this point, task is not marked as processed so it can be retried on restart if needed.
    }
  }
}

// ---------------------- Event Subscription --------------------------- //
// Set up listeners for both AssignTask events (by client or by agent) for this agent.
async function subscribeToEvents() {
  // Filter events to only those where the agent (2nd indexed param) is this agent's address
  const agentAddress = config.agentAddress;
  const filterClient = contract.filters.AssignTaskByClient(null, agentAddress);
  const filterAgent  = contract.filters.AssignTaskByAgent(null, agentAddress);

  // Handle new events as they come in
  contract.on(filterClient, (taskId, agent) => {
    // Note: filter already ensures agent === agentAddress
    processTaskAssignment(taskId).catch(err => console.error("Task processing error:", err));
  });
  contract.on(filterAgent, (taskId, agent) => {
    processTaskAssignment(taskId).catch(err => console.error("Task processing error:", err));
  });

  console.log("Event listeners subscribed for AssignTaskByClient and AssignTaskByAgent.");
}

// ---------------------- Initial Event Catch-up ----------------------- //
// On startup, process any assignment events that might have been missed while offline.
async function catchUpPastEvents() {
  try {
    const fromBlock = store.lastProcessedBlock 
                      ? store.lastProcessedBlock + 1 
                      : (config.contractDeploymentBlock || 0);
    const latestBlock = await provider.getBlockNumber();
    if (latestBlock < fromBlock) {
      // Nothing to catch up (if last processed block is already latest)
      return;
    }
    console.log(`Catching up events from block ${fromBlock} to ${latestBlock}...`);
    const eventsClient = await contract.queryFilter(contract.filters.AssignTaskByClient(null, config.agentAddress), fromBlock, latestBlock);
    const eventsAgent  = await contract.queryFilter(contract.filters.AssignTaskByAgent(null, config.agentAddress), fromBlock, latestBlock);
    const allEvents = [...eventsClient, ...eventsAgent];
    // Sort events by block number to process in chronological order
    allEvents.sort((a, b) => (a.blockNumber - b.blockNumber) || (a.logIndex - b.logIndex));
    for (const event of allEvents) {
      const { args, eventName, blockNumber } = event;
      if (!args) continue;
      const taskId = args.taskId || args[0];  // args: [taskId, agent]
      // Process each historical event
      console.log(`Processing past event ${eventName} for task ${taskId.toString()} (block ${blockNumber})`);
      await processTaskAssignment(taskId);
      // Update lastProcessedBlock as we go
      store.lastProcessedBlock = blockNumber;
      saveStore();
    }
    // After catching up, update lastProcessedBlock to latestBlock
    store.lastProcessedBlock = latestBlock;
    saveStore();
    console.log("Past events catch-up complete.");
  } catch (err) {
    console.error("Error during past events catch-up:", err);
  }
}

// ------------------------ Module Initialization ---------------------- //
async function startModule() {
  console.log("Starting ACT Marketplace MCP module...");
  console.log(`Agent Address: ${config.agentAddress}`);
  console.log(`Contract Address: ${config.contractAddress}`);
  // Ensure we have a valid configuration
  if (!config.agentPrivateKey || !config.agentAddress || !config.contractAddress) {
    console.error("Missing configuration! Please set PRIVATE_KEY, PUBLIC_KEY, and CONTRACT_ADDRESS.");
    return;
  }
  // Catch up with any missed events, then subscribe to new ones
  await catchUpPastEvents();
  await subscribeToEvents();
  console.log("ACT Marketplace module initialization complete. Waiting for task assignments...");
}

// Start the module (if this script is run in the agent server context, it will execute on load)
startModule().catch(err => console.error("Failed to start module:", err));
