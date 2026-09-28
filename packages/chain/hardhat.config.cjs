// AnchorRegistry (CLAUDE.md §27). Hardhat local node only; Besu is the stated production direction.
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');

const SOLC = '0.8.24';

// Compile with the npm `solc` (solc-js) package instead of downloading a native compiler from
// binaries.soliditylang.org — works offline and in sandboxed CI.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  if (args.solcVersion !== SOLC) return runSuper();
  const solc = require('solc');
  return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs: true, version: SOLC, longVersion: solc.version() };
});

module.exports = {
  solidity: SOLC,
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545', chainId: 31337 },
  },
};
