// `pnpm chain:deploy`: deploys AnchorRegistry to the local node, grants ANCHORER_ROLE to the relayer
// (Hardhat account #1), and writes CHAIN_ANCHOR_CONTRACT / CHAIN_RELAYER_PRIVATE_KEY into .env.local.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('hardhat');

// Hardhat's well-known deterministic dev key for account #1 — local node only, never a real key.
const HARDHAT_ACCOUNT_1_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function main() {
  const [admin, relayer] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory('AnchorRegistry');
  const reg = await Registry.deploy(admin.address);
  await reg.waitForDeployment();
  await (await reg.grantRole(await reg.ANCHORER_ROLE(), relayer.address)).wait();
  const address = await reg.getAddress();
  const file = path.join(__dirname, '..', '..', '..', '.env.local');
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !/^CHAIN_(ANCHOR_CONTRACT|RELAYER_PRIVATE_KEY)=/.test(l)) : [];
  lines.push(`CHAIN_ANCHOR_CONTRACT=${address}`, `CHAIN_RELAYER_PRIVATE_KEY=${HARDHAT_ACCOUNT_1_KEY}`);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(`AnchorRegistry deployed at ${address}; relayer ${relayer.address} has ANCHORER_ROLE; wrote .env.local`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
