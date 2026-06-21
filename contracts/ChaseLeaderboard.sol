// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Chase · Zero — on-chain tournament leaderboard (Phase 3, 0G Chain / Galileo testnet).
 *
 * Each finished match is posted here by the game server: the winner, their score, and
 * the 0G Storage Merkle root hash of that match's verifiable replay bundle. Because the
 * root hash addresses the replay (result + the real 0G Compute AI decision transcript),
 * a leaderboard row is trustlessly verifiable end to end: score ↔ replay ↔ AI reasoning.
 */
contract ChaseLeaderboard {
    struct MatchResult {
        string winner;     // winner display name
        uint256 score;     // egg grabs by the winner
        string rootHash;   // 0G Storage Merkle root of the replay bundle
        uint64 timestamp;  // block time of submission
        address submitter; // who posted it (the game server wallet)
    }

    MatchResult[] private results;

    event MatchSubmitted(
        uint256 indexed id,
        string winner,
        uint256 score,
        string rootHash,
        address indexed submitter
    );

    /// Post a finished match. Returns its leaderboard id.
    function submitMatch(
        string calldata winner,
        uint256 score,
        string calldata rootHash
    ) external returns (uint256 id) {
        id = results.length;
        results.push(
            MatchResult({
                winner: winner,
                score: score,
                rootHash: rootHash,
                timestamp: uint64(block.timestamp),
                submitter: msg.sender
            })
        );
        emit MatchSubmitted(id, winner, score, rootHash, msg.sender);
    }

    function totalMatches() external view returns (uint256) {
        return results.length;
    }

    function getMatch(uint256 id) external view returns (MatchResult memory) {
        require(id < results.length, "out of range");
        return results[id];
    }

    /// The most recent `n` matches, newest first.
    function getRecent(uint256 n) external view returns (MatchResult[] memory) {
        uint256 len = results.length;
        if (n > len) n = len;
        MatchResult[] memory out = new MatchResult[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = results[len - 1 - i];
        }
        return out;
    }
}
