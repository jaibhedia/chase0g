/**
 * Deploy ChaseLeaderboard to the 0G Galileo testnet (Phase 3).
 *
 *   cd contracts
 *   npm install                       # solc + ethers (one time)
 *   OG_PRIVATE_KEY=0x... npm run deploy
 *
 * Needs a funded Galileo testnet wallet (the same OG_PRIVATE_KEY the server uses).
 * Prints the deployed address — put it in server/.env as OG_LEADERBOARD_ADDRESS, and
 * NEXT_PUBLIC_LEADERBOARD_ADDRESS if you want the client to read it directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC = process.env.OG_EVM_RPC || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('✗ Set OG_PRIVATE_KEY to a funded Galileo testnet wallet (0x… 64-hex).');
  process.exit(1);
}

// --- compile ---
const source = fs.readFileSync(path.join(__dirname, 'ChaseLeaderboard.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'ChaseLeaderboard.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const fatal = (output.errors || []).filter((e) => e.severity === 'error');
(output.errors || []).forEach((e) => console.log(e.formattedMessage));
if (fatal.length) process.exit(1);

const artifact = output.contracts['ChaseLeaderboard.sol'].ChaseLeaderboard;
const abi = artifact.abi;
const bytecode = artifact.evm.bytecode.object;

// --- deploy ---
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const balance = await provider.getBalance(wallet.address);
console.log(`Deployer: ${wallet.address}  balance: ${ethers.formatEther(balance)} OG`);
console.log(`RPC: ${RPC}`);

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy();
console.log('Deploy tx:', contract.deploymentTransaction()?.hash);
await contract.waitForDeployment();
const address = await contract.getAddress();

fs.writeFileSync(path.join(__dirname, 'ChaseLeaderboard.abi.json'), JSON.stringify(abi, null, 2));

console.log('\n✓ ChaseLeaderboard deployed at:', address);
console.log('  ABI written to contracts/ChaseLeaderboard.abi.json');
console.log('\nNext: add to server/.env');
console.log('  OG_LEADERBOARD_ADDRESS=' + address);
