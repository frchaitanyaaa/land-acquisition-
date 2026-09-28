const { expect } = require('chai');
const { ethers } = require('hardhat');

// §32.6: only ANCHORER_ROLE can anchor; a (key, version) is immutable; latestVersion; batch.
describe('AnchorRegistry', () => {
  async function deploy() {
    const [admin, relayer, outsider] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory('AnchorRegistry');
    const reg = await Registry.deploy(admin.address);
    await reg.grantRole(await reg.ANCHORER_ROLE(), relayer.address);
    return { reg, admin, relayer, outsider };
  }
  const key = ethers.keccak256(ethers.toUtf8Bytes('land_parcel:11111111-1111-4111-8111-111111111111'));
  const h1 = ethers.keccak256(ethers.toUtf8Bytes('v1'));
  const h2 = ethers.keccak256(ethers.toUtf8Bytes('v2'));

  it('only an anchorer can anchor', async () => {
    const { reg, outsider } = await deploy();
    await expect(reg.connect(outsider).anchor(key, 1, h1, 'PARCEL_VERIFIED')).to.be.reverted;
  });

  it('anchors, reads back, and refuses to overwrite a version', async () => {
    const { reg, relayer } = await deploy();
    await expect(reg.connect(relayer).anchor(key, 1, h1, 'PARCEL_VERIFIED')).to.emit(reg, 'Anchored');
    const a = await reg.getAnchor(key, 1);
    expect(a.dataHash).to.equal(h1);
    expect(a.eventType).to.equal('PARCEL_VERIFIED');
    await expect(reg.connect(relayer).anchor(key, 1, h2, 'PARCEL_VERIFIED')).to.be.revertedWith('version already anchored');
  });

  it('tracks the latest version', async () => {
    const { reg, relayer } = await deploy();
    await reg.connect(relayer).anchor(key, 2, h2, 'PARCEL_CORRECTED');
    await reg.connect(relayer).anchor(key, 1, h1, 'PARCEL_VERIFIED');
    expect(await reg.latestVersion(key)).to.equal(2n);
  });

  it('anchors in batch', async () => {
    const { reg, relayer } = await deploy();
    const k2 = ethers.keccak256(ethers.toUtf8Bytes('award:x'));
    await reg.connect(relayer).anchorBatch([key, k2], [1, 1], [h1, h2], ['A', 'B']);
    expect((await reg.getAnchor(k2, 1)).dataHash).to.equal(h2);
    await expect(reg.connect(relayer).anchorBatch([key], [1, 2], [h1], ['A'])).to.be.revertedWith('length mismatch');
  });
});
