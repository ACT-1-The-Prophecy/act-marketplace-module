import { ethers } from "ethers";
import marketplaceAbi from "@act-1-the-prophecy/contract";  // Contains marketplaceAbi JSON

// ==== Configuration ====
const RPC_URL       = process.env.RPC_URL as string | undefined;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS as string | undefined;
const PRIVATE_KEY   = process.env.PRIVATE_KEY as string | undefined;
const PUBLIC_KEY    = process.env.PUBLIC_KEY as string | undefined;

if (!RPC_URL || !CONTRACT_ADDR) {
  console.error("[ACT Marketplace] ERROR: RPC_URL or CONTRACT_ADDRESS not set in environment.");
}
// Initialize ethers provider and contract instances
const provider     = new ethers.JsonRpcProvider(RPC_URL);
const contractRead = new ethers.Contract(CONTRACT_ADDR ?? "", marketplaceAbi.marketplaceAbi, provider);
const contractSigner = PRIVATE_KEY 
  ? new ethers.Contract(CONTRACT_ADDR ?? "", marketplaceAbi.marketplaceAbi, new ethers.Wallet(PRIVATE_KEY, provider))
  : null;

// ==== Helper Functions ====

// Logging helpers for consistent prefix and levels
const MODULE = "ACT Marketplace";
function logInfo(message: string)  { console.info(`[${MODULE}] ${message}`); }
function logError(message: string) { console.error(`[${MODULE}] ${message}`); }
function logDebug(message: string) { console.debug(`[${MODULE}] ${message}`); }

// Validate task ID input (expect number, string, or bigint; convert to bigint)
function validateTaskId(id: unknown): bigint {
  if (typeof id === "string") {
    if (!/^[0-9]+$/.test(id)) {
      throw new Error("Invalid taskId: must be a numeric string.");
    }
    return BigInt(id);
  }
  if (typeof id === "number") {
    if (!Number.isInteger(id) || id < 0) {
      throw new Error("Invalid taskId: must be a non-negative integer.");
    }
    return BigInt(id);
  }
  if (typeof id === "bigint") {
    if (id < 0n) {
      throw new Error("Invalid taskId: must be non-negative.");
    }
    return id;
  }
  throw new Error("Invalid taskId: unsupported type.");
}

// Validate Ethereum address input (must be a 0x... hex string of length 42)
function validateAddress(addr: unknown): string {
  if (typeof addr !== "string") {
    throw new Error("Invalid address: expected a string.");
  }
  if (!ethers.isAddress(addr)) {
    throw new Error(`Invalid address format: "${addr}"`);
  }
  // Return checksummed address for consistency
  return ethers.getAddress(addr);
}

// Normalize BigInt (or BigNumber) values in results to plain numbers or strings for safe JSON serialization
function normalizeResult(data: any): any {
  if (data == null) return data;
  if (typeof data === "bigint") {
    // Convert BigInt to string (JSON cannot serialize BigInt)
    return data.toString();
  }
  if (typeof data === "object") {
    // If data is an ethers BigNumber (v5) convert to string
    if (data._isBigNumber) {
      return data.toString();
    }
    // If data is an array or object, recursively normalize each field
    if (Array.isArray(data)) {
      return data.map(item => normalizeResult(item));
    } else {
      const normalized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip numeric index keys that ethers may include for tuple/struct results
        if (!isNaN(Number(key))) continue;
        normalized[key] = normalizeResult(value);
      }
      return normalized;
    }
  }
  // Primitive (string, number, boolean) – return as is
  return data;
}

// ==== Actions Definition ====
const actions = [
  {
    name: "getTask",
    description: "Fetch details of a task by ID from the ACT Marketplace contract.",
    inputSchema: {
      type: "object",
      properties: { 
        taskId: { type: "integer", minimum: 0 } 
      },
      required: ["taskId"]
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: { taskId: unknown }) => {
      const taskId = validateTaskId(params.taskId);
      logInfo(`getTask: Fetching task ${taskId}...`);
      let task;
      try {
        if (typeof contractRead.getTask === "function") {
          task = await contractRead.getTask(taskId);
        } else if (typeof contractRead.tasks === "function") {
          task = await contractRead.tasks(taskId);
        } else {
          throw new Error("Contract does not have getTask method");
        }
        logInfo(`getTask: Task ${taskId} fetched successfully.`);
      } catch (error: any) {
        logError(`getTask: Failed to fetch task ${taskId} - ${error.message}`);
        throw error;
      }
      // Decode bytes32 topic to string for readability, if present
      if (task && task.topic != null) {
        try {
          task.topic = ethers.decodeBytes32String(task.topic);
        } catch {/* if decoding fails, leave as-is */}
      }
      return normalizeResult(task);
    }
  },
  {
    name: "getAgent",
    description: "Retrieve registration info for an agent by address.",
    inputSchema: {
      type: "object",
      properties: { 
        agent: { type: "string", pattern: "^0x[0-9A-Fa-f]{40}$" } 
      },
      required: ["agent"]
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: { agent: unknown }) => {
      const agentAddr = validateAddress(params.agent);
      logInfo(`getAgent: Fetching agent data for ${agentAddr}...`);
      let agentData;
      try {
        if (typeof contractRead.getAgent === "function") {
          agentData = await contractRead.getAgent(agentAddr);
        } else if (typeof contractRead.agents === "function") {
          agentData = await contractRead.agents(agentAddr);
        } else {
          throw new Error("Contract does not have getAgent method");
        }
        logInfo(`getAgent: Data for agent ${agentAddr} retrieved.`);
      } catch (error: any) {
        logError(`getAgent: Failed to fetch agent ${agentAddr} - ${error.message}`);
        throw error;
      }
      return normalizeResult(agentData);
    }
  },
  {
    name: "getValidator",
    description: "Retrieve registration info for a validator by address.",
    inputSchema: {
      type: "object",
      properties: { 
        validator: { type: "string", pattern: "^0x[0-9A-Fa-f]{40}$" } 
      },
      required: ["validator"]
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: { validator: unknown }) => {
      const valAddr = validateAddress(params.validator);
      logInfo(`getValidator: Fetching validator data for ${valAddr}...`);
      let validatorData;
      try {
        if (typeof contractRead.getValidator === "function") {
          validatorData = await contractRead.getValidator(valAddr);
        } else if (typeof contractRead.validators === "function") {
          validatorData = await contractRead.validators(valAddr);
        } else {
          throw new Error("Contract does not have getValidator method");
        }
        logInfo(`getValidator: Data for validator ${valAddr} retrieved.`);
      } catch (error: any) {
        logError(`getValidator: Failed to fetch validator ${valAddr} - ${error.message}`);
        throw error;
      }
      return normalizeResult(validatorData);
    }
  },
  {
    name: "getBalance",
    description: "Get the token balance (escrowed in the marketplace) for a given address. If no address is provided, uses the default configured address.",
    inputSchema: {
      type: "object",
      properties: { 
        address: { type: "string", pattern: "^0x[0-9A-Fa-f]{40}$" } 
      },
      required: []  // address is optional
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: { address?: unknown }) => {
      const targetAddr = params.address ? validateAddress(params.address) : (PUBLIC_KEY ?? "").toString();
      if (!targetAddr) {
        throw new Error("No address provided for getBalance and no default PUBLIC_KEY is set.");
      }
      logInfo(`getBalance: Checking balance for ${targetAddr}...`);
      let balance;
      try {
        if (typeof contractRead.getBalance === "function") {
          balance = await contractRead.getBalance(targetAddr);
        } else if (typeof contractRead.balanceOf === "function") {
          balance = await contractRead.balanceOf(targetAddr);
        } else if (typeof contractRead.balances === "function") {
          balance = await contractRead.balances(targetAddr);
        } else {
          throw new Error("Contract does not have getBalance method");
        }
        logInfo(`getBalance: Balance for ${targetAddr} retrieved.`);
      } catch (error: any) {
        logError(`getBalance: Failed to get balance for ${targetAddr} - ${error.message}`);
        throw error;
      }
      // Return balance as a normal number or string
      return normalizeResult(balance);
    }
  },
  {
    name: "withdrawClientTokens",
    description: "Withdraw refundable tokens for the client (task owner) associated with this marketplace instance.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    annotations: { destructiveHint: true },
    handler: async () => {
      if (!PRIVATE_KEY || !PUBLIC_KEY) {
        throw new Error("Cannot withdraw: no private key (client account) configured.");
      }
      const ownerAddr = PUBLIC_KEY;
      logInfo(`withdrawClientTokens: Initiating withdrawal for ${ownerAddr}...`);

      // Pre-check token balance to ensure there are tokens to withdraw
      if (typeof contractRead.getBalance === "function" || typeof contractRead.balanceOf === "function" || typeof contractRead.balances === "function") {
        try {
          let bal: any;
          if (typeof contractRead.getBalance === "function") {
            bal = await contractRead.getBalance(ownerAddr);
          } else if (typeof contractRead.balanceOf === "function") {
            bal = await contractRead.balanceOf(ownerAddr);
          } else if (typeof contractRead.balances === "function") {
            bal = await contractRead.balances(ownerAddr);
          }
          const balBigInt: bigint = typeof bal === "bigint" ? bal : BigInt(bal.toString());
          if (balBigInt === 0n) {
            logError(`withdrawClientTokens: No tokens to withdraw for ${ownerAddr}.`);
            throw new Error("No tokens available to withdraw.");
          }
        } catch (error: any) {
          if (error.message && /No tokens available/.test(error.message)) {
            throw error; // no tokens, stop here
          }
          // If balance check failed (perhaps unsupported), log and proceed
          logDebug("withdrawClientTokens: Balance check unavailable or failed, proceeding with withdraw.");
        }
      }

      if (!contractSigner) {
        logError("withdrawClientTokens: No signer available for withdrawal transaction.");
        throw new Error("Withdrawal failed: no signer configured.");
      }
      try {
        if (typeof contractSigner.withdrawClientTokens !== "function") {
          throw new Error("Contract does not have withdrawClientTokens function");
        }
        const tx = await contractSigner.withdrawClientTokens();
        logInfo(`withdrawClientTokens: Transaction submitted (hash: ${tx.hash}). Waiting for confirmation...`);
        const receipt = await tx.wait();
        logInfo(`withdrawClientTokens: Transaction confirmed in block ${receipt.blockNumber}.`);
        return { txHash: tx.hash, status: "success", blockNumber: receipt.blockNumber };
      } catch (error: any) {
        logError(`withdrawClientTokens: Withdrawal failed - ${error.message}`);
        throw error;
      }
    }
  }
];

// ==== Module Export ====
export const marketplacePlugin = {
  name: "ACT Marketplace",
  description: "MCP module for interacting with the ACT Marketplace smart contract.",
  actions: actions,
  providers: [],   // no custom providers needed
  evaluators: [],  // no custom evaluators
  services: []     // (event listening service is omitted in MCP context)
};
export default marketplacePlugin;
