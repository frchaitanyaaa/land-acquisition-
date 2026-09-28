// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AnchorRegistry — hashes of human-approved BhoomiSetu records (CLAUDE.md §27).
/// @notice Stores only a sha256 of a canonical (RFC 8785) payload per (entity, version). No personal data.
contract AnchorRegistry is AccessControl {
    bytes32 public constant ANCHORER_ROLE = keccak256("ANCHORER_ROLE");

    struct Anchor {
        bytes32 dataHash;
        uint64 anchoredAt;
        address anchorer;
        string eventType;
    }

    // key = keccak256(abi.encodePacked(entityType, ":", entityId))
    mapping(bytes32 => mapping(uint32 => Anchor)) private anchors;
    mapping(bytes32 => uint32) public latestVersion;

    event Anchored(bytes32 indexed key, uint32 indexed version, bytes32 dataHash, string eventType, address anchorer);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function anchor(bytes32 key, uint32 version, bytes32 dataHash, string calldata eventType) public onlyRole(ANCHORER_ROLE) {
        require(anchors[key][version].anchoredAt == 0, "version already anchored"); // immutable per version
        anchors[key][version] = Anchor(dataHash, uint64(block.timestamp), msg.sender, eventType);
        if (version > latestVersion[key]) latestVersion[key] = version;
        emit Anchored(key, version, dataHash, eventType, msg.sender);
    }

    function anchorBatch(
        bytes32[] calldata keys,
        uint32[] calldata versions,
        bytes32[] calldata hashes,
        string[] calldata eventTypes
    ) external onlyRole(ANCHORER_ROLE) {
        require(keys.length == versions.length && keys.length == hashes.length && keys.length == eventTypes.length, "length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            anchor(keys[i], versions[i], hashes[i], eventTypes[i]);
        }
    }

    function getAnchor(bytes32 key, uint32 version) external view returns (Anchor memory) {
        return anchors[key][version];
    }
}
