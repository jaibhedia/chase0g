// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ChaseStake — USDC match-stake escrow for Chase, on Arc.
 *
 * Every ranked match is one escrow: players (humans and AI agents alike) each put up
 * the same USDC stake, the game server posts the winner when the round ends, and the
 * pot pays out in a single transfer. A `replayRoot` — the 0G Storage Merkle root of
 * that match's replay bundle — is emitted with the settlement, so a payout is
 * traceable back to the recorded match and its AI decision transcript.
 *
 * Deliberately four functions. This holds real money; every branch below should be
 * readable in one sitting.
 *
 * Arc specifics:
 *   - USDC is Arc's native gas asset, but this contract only ever touches the ERC-20
 *     interface at USDC (6 decimals). It never uses msg.value. 1 USDC == 1_000_000.
 *   - Players must `approve` this contract for their stake before joining.
 *
 * Trust model: the server settles. It chooses the winner but cannot choose the amount,
 * cannot pay a non-participant, and cannot pay itself unless it played. If the server
 * never settles, `refund` lets every player recover their own stake after REFUND_DELAY.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ChaseStake {
    /// USDC's ERC-20 interface on Arc. 6 decimals. Not configurable by design.
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    /// How long after a match opens before unsettled stakes can be reclaimed.
    uint64 public constant REFUND_DELAY = 1 hours;

    /// Ceiling on players per match. Bounds the settle-time loop and the players array.
    uint256 public constant MAX_PLAYERS = 8;

    /// The game server. Only it can settle. Rotatable by itself.
    address public server;

    struct Match {
        address host;
        uint256 stake; // per player, 6 decimals
        uint256 pot; // held by this contract for this match
        uint64 deadline; // refunds open at this timestamp
        bool settled;
        address[] players;
    }

    mapping(bytes32 => Match) private _matches;
    mapping(bytes32 => mapping(address => bool)) public joined;
    mapping(bytes32 => mapping(address => bool)) public refunded;

    event MatchCreated(bytes32 indexed matchId, address indexed host, uint256 stake, uint64 deadline);
    event PlayerJoined(bytes32 indexed matchId, address indexed player, uint256 stake, uint256 pot);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 pot, string replayRoot);
    event Refunded(bytes32 indexed matchId, address indexed player, uint256 amount);
    event ServerChanged(address indexed previous, address indexed next);

    error NotServer();
    error ZeroAddress();
    error MatchExists();
    error NoSuchMatch();
    error AlreadySettled();
    error AlreadyJoined();
    error MatchFull();
    error ZeroStake();
    error JoinClosed();
    error WinnerNotInMatch();
    error TooEarlyToRefund();
    error NothingToRefund();
    error TransferFailed();

    constructor(address server_) {
        if (server_ == address(0)) revert ZeroAddress();
        server = server_;
        emit ServerChanged(address(0), server_);
    }

    modifier onlyServer() {
        if (msg.sender != server) revert NotServer();
        _;
    }

    // --- Core: create / join / settle / refund ------------------------------------

    /// Open a match at a fixed per-player stake. The host joins in the same call.
    function createMatch(bytes32 matchId, uint256 stake) external {
        if (stake == 0) revert ZeroStake();
        Match storage m = _matches[matchId];
        if (m.host != address(0)) revert MatchExists();

        m.host = msg.sender;
        m.stake = stake;
        m.deadline = uint64(block.timestamp) + REFUND_DELAY;

        emit MatchCreated(matchId, msg.sender, stake, m.deadline);
        _join(matchId, m);
    }

    /// Put up the match's stake and enter. Requires prior USDC approval.
    function join(bytes32 matchId) external {
        Match storage m = _matches[matchId];
        if (m.host == address(0)) revert NoSuchMatch();
        if (m.settled) revert AlreadySettled();
        // Once refunds are open the match is winding down; no new money in.
        if (block.timestamp >= m.deadline) revert JoinClosed();
        _join(matchId, m);
    }

    /// Pay the whole pot to the winner. Server only.
    function settle(bytes32 matchId, address winner, string calldata replayRoot) external onlyServer {
        Match storage m = _matches[matchId];
        if (m.host == address(0)) revert NoSuchMatch();
        if (m.settled) revert AlreadySettled();
        if (!joined[matchId][winner]) revert WinnerNotInMatch();

        uint256 pot = m.pot;
        m.settled = true;
        m.pot = 0;

        emit MatchSettled(matchId, winner, pot, replayRoot);
        _safeTransfer(winner, pot);
    }

    /// Reclaim your own stake if the server never settled. Open after REFUND_DELAY.
    function refund(bytes32 matchId) external {
        Match storage m = _matches[matchId];
        if (m.host == address(0)) revert NoSuchMatch();
        if (m.settled) revert AlreadySettled();
        if (block.timestamp < m.deadline) revert TooEarlyToRefund();
        if (!joined[matchId][msg.sender] || refunded[matchId][msg.sender]) revert NothingToRefund();

        refunded[matchId][msg.sender] = true;
        uint256 amount = m.stake;
        m.pot -= amount;

        emit Refunded(matchId, msg.sender, amount);
        _safeTransfer(msg.sender, amount);
    }

    // --- Admin --------------------------------------------------------------------

    /// Hand settlement authority to a new server address.
    function setServer(address next) external onlyServer {
        if (next == address(0)) revert ZeroAddress();
        emit ServerChanged(server, next);
        server = next;
    }

    // --- Views --------------------------------------------------------------------

    function getMatch(bytes32 matchId)
        external
        view
        returns (address host, uint256 stake, uint256 pot, uint64 deadline, bool settled, address[] memory players)
    {
        Match storage m = _matches[matchId];
        return (m.host, m.stake, m.pot, m.deadline, m.settled, m.players);
    }

    function playerCount(bytes32 matchId) external view returns (uint256) {
        return _matches[matchId].players.length;
    }

    function exists(bytes32 matchId) external view returns (bool) {
        return _matches[matchId].host != address(0);
    }

    // --- Internals ----------------------------------------------------------------

    function _join(bytes32 matchId, Match storage m) private {
        if (joined[matchId][msg.sender]) revert AlreadyJoined();
        if (m.players.length >= MAX_PLAYERS) revert MatchFull();

        // Effects before the external call: a re-entrant join would hit AlreadyJoined.
        joined[matchId][msg.sender] = true;
        m.players.push(msg.sender);
        m.pot += m.stake;

        _safeTransferFrom(msg.sender, address(this), m.stake);
        emit PlayerJoined(matchId, msg.sender, m.stake, m.pot);
    }

    /**
     * ERC-20 calls that tolerate implementations returning nothing instead of a bool.
     * Arc's USDC is a precompiled native asset behind an ERC-20 facade, so we do not
     * assume it returns data exactly like a vanilla OpenZeppelin token.
     */
    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(USDC).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            address(USDC).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
