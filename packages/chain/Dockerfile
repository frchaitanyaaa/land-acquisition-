# Local permissioned-chain stand-in (CLAUDE.md §27). Deterministic Hardhat accounts on :8545.
# Installs Hardhat inside the image so the host OS (Linux / macOS) never matters.
FROM node:24-slim
WORKDIR /chain
ENV HARDHAT_DISABLE_TELEMETRY_PROMPT=true
RUN npm init -y >/dev/null && npm install --no-audit --no-fund hardhat@2.29.1 && npm cache clean --force
COPY hardhat.node.cjs ./hardhat.config.cjs
EXPOSE 8545
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
