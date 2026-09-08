// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChaseStake} from "../src/ChaseStake.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract ChaseStakeTest is Test {
    address constant USDC_ADDR = 0x3600000000000000000000000000000000000000;
    uint256 constant STAKE = 1e6; // 1 USDC, 6 decimals

    ChaseStake stake;
    MockUSDC usdc;

    address server = makeAddr("server");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address agent = makeAddr("agent"); // an AI agent is just another address

    bytes32 constant MATCH = keccak256("match-1");

    function setUp() public {
        // Arc's USDC lives at a fixed address, so put the mock's runtime code there.
        vm.etch(USDC_ADDR, address(new MockUSDC()).code);
        usdc = MockUSDC(USDC_ADDR);

        stake = new ChaseStake(server);

        address[4] memory funded = [alice, bob, carol, agent];
        for (uint256 i = 0; i < funded.length; i++) {
            usdc.mint(funded[i], 100e6);
            vm.prank(funded[i]);
            usdc.approve(address(stake), type(uint256).max);
        }
    }

    function _open() internal {
        vm.prank(alice);
        stake.createMatch(MATCH, STAKE);
    }

    // --- Happy path ---------------------------------------------------------------

    function test_createMatch_joinsHostAndEscrowsStake() public {
        _open();

        (address host, uint256 s, uint256 pot,, bool settled, address[] memory players) = stake.getMatch(MATCH);

        assertEq(host, alice);
        assertEq(s, STAKE);
        assertEq(pot, STAKE);
        assertFalse(settled);
        assertEq(players.length, 1);
        assertEq(players[0], alice);
        assertEq(usdc.balanceOf(address(stake)), STAKE);
        assertEq(usdc.balanceOf(alice), 100e6 - STAKE);
    }

    function test_fullRound_potPaysWinner() public {
        _open();
        vm.prank(bob);
        stake.join(MATCH);
        vm.prank(agent);
        stake.join(MATCH);

        assertEq(stake.playerCount(MATCH), 3);
        assertEq(usdc.balanceOf(address(stake)), 3 * STAKE);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(server);
        stake.settle(MATCH, bob, "0gReplayRoot");

        assertEq(usdc.balanceOf(bob) - before, 3 * STAKE);
        assertEq(usdc.balanceOf(address(stake)), 0, "escrow must be empty after settle");

        (,, uint256 pot,, bool settled,) = stake.getMatch(MATCH);
        assertEq(pot, 0);
        assertTrue(settled);
    }

    /// An AI agent with its own wallet is a first-class entrant (feature A5).
    function test_agentCanWinAndBePaid() public {
        _open();
        vm.prank(agent);
        stake.join(MATCH);

        uint256 before = usdc.balanceOf(agent);
        vm.prank(server);
        stake.settle(MATCH, agent, "0gReplayRoot");

        assertEq(usdc.balanceOf(agent) - before, 2 * STAKE);
    }

    function test_settleEmitsReplayRootForTraceability() public {
        _open();
        vm.expectEmit(true, true, false, true);
        emit ChaseStake.MatchSettled(MATCH, alice, STAKE, "0g-root-abc");
        vm.prank(server);
        stake.settle(MATCH, alice, "0g-root-abc");
    }

    // --- Join guards --------------------------------------------------------------

    function test_doubleJoin_reverts() public {
        _open();
        vm.prank(bob);
        stake.join(MATCH);

        vm.prank(bob);
        vm.expectRevert(ChaseStake.AlreadyJoined.selector);
        stake.join(MATCH);
    }

    function test_hostCannotJoinTwice() public {
        _open();
        vm.prank(alice);
        vm.expectRevert(ChaseStake.AlreadyJoined.selector);
        stake.join(MATCH);
    }

    function test_duplicateMatchId_reverts() public {
        _open();
        vm.prank(bob);
        vm.expectRevert(ChaseStake.MatchExists.selector);
        stake.createMatch(MATCH, STAKE);
    }

    function test_joinUnknownMatch_reverts() public {
        vm.prank(bob);
        vm.expectRevert(ChaseStake.NoSuchMatch.selector);
        stake.join(keccak256("nope"));
    }

    function test_zeroStake_reverts() public {
        vm.prank(alice);
        vm.expectRevert(ChaseStake.ZeroStake.selector);
        stake.createMatch(MATCH, 0);
    }

    function test_joinAfterDeadline_reverts() public {
        _open();
        vm.warp(block.timestamp + stake.REFUND_DELAY());
        vm.prank(bob);
        vm.expectRevert(ChaseStake.JoinClosed.selector);
        stake.join(MATCH);
    }

    function test_joinBeyondMaxPlayers_reverts() public {
        _open(); // alice is player 1
        for (uint256 i = 1; i < stake.MAX_PLAYERS(); i++) {
            address p = makeAddr(string(abi.encodePacked("p", i)));
            usdc.mint(p, 10e6);
            vm.startPrank(p);
            usdc.approve(address(stake), type(uint256).max);
            stake.join(MATCH);
            vm.stopPrank();
        }
        assertEq(stake.playerCount(MATCH), stake.MAX_PLAYERS());

        vm.prank(bob);
        vm.expectRevert(ChaseStake.MatchFull.selector);
        stake.join(MATCH);
    }

    function test_joinWithoutApproval_reverts() public {
        _open();
        address broke = makeAddr("broke");
        usdc.mint(broke, 10e6);
        vm.prank(broke);
        vm.expectRevert(ChaseStake.TransferFailed.selector);
        stake.join(MATCH);
    }

    // --- Settle authority ---------------------------------------------------------

    function test_nonServerSettle_reverts() public {
        _open();
        vm.prank(alice);
        vm.expectRevert(ChaseStake.NotServer.selector);
        stake.settle(MATCH, alice, "root");
    }

    function test_settleNonParticipant_reverts() public {
        _open();
        vm.prank(server);
        vm.expectRevert(ChaseStake.WinnerNotInMatch.selector);
        stake.settle(MATCH, carol, "root");
    }

    /// The server picks the winner but cannot pay itself unless it played.
    function test_serverCannotPayItself() public {
        _open();
        vm.prank(server);
        vm.expectRevert(ChaseStake.WinnerNotInMatch.selector);
        stake.settle(MATCH, server, "root");
    }

    function test_doubleSettle_reverts() public {
        _open();
        vm.startPrank(server);
        stake.settle(MATCH, alice, "root");
        vm.expectRevert(ChaseStake.AlreadySettled.selector);
        stake.settle(MATCH, alice, "root");
        vm.stopPrank();
    }

    // --- Refund -------------------------------------------------------------------

    function test_refundBeforeDeadline_reverts() public {
        _open();
        vm.prank(alice);
        vm.expectRevert(ChaseStake.TooEarlyToRefund.selector);
        stake.refund(MATCH);
    }

    function test_refundAfterDeadline_returnsEveryStake() public {
        _open();
        vm.prank(bob);
        stake.join(MATCH);

        vm.warp(block.timestamp + stake.REFUND_DELAY());

        vm.prank(alice);
        stake.refund(MATCH);
        vm.prank(bob);
        stake.refund(MATCH);

        assertEq(usdc.balanceOf(alice), 100e6);
        assertEq(usdc.balanceOf(bob), 100e6);
        assertEq(usdc.balanceOf(address(stake)), 0, "no funds may be stranded");
    }

    function test_doubleRefund_reverts() public {
        _open();
        vm.warp(block.timestamp + stake.REFUND_DELAY());
        vm.startPrank(alice);
        stake.refund(MATCH);
        vm.expectRevert(ChaseStake.NothingToRefund.selector);
        stake.refund(MATCH);
        vm.stopPrank();
    }

    function test_refundByNonPlayer_reverts() public {
        _open();
        vm.warp(block.timestamp + stake.REFUND_DELAY());
        vm.prank(carol);
        vm.expectRevert(ChaseStake.NothingToRefund.selector);
        stake.refund(MATCH);
    }

    function test_refundAfterSettle_reverts() public {
        _open();
        vm.prank(server);
        stake.settle(MATCH, alice, "root");

        vm.warp(block.timestamp + stake.REFUND_DELAY());
        vm.prank(alice);
        vm.expectRevert(ChaseStake.AlreadySettled.selector);
        stake.refund(MATCH);
    }

    /// Documented edge: a late settle after partial refunds pays only what is left.
    function test_settleAfterPartialRefund_paysRemainingPot() public {
        _open();
        vm.prank(bob);
        stake.join(MATCH);

        vm.warp(block.timestamp + stake.REFUND_DELAY());
        vm.prank(bob);
        stake.refund(MATCH); // bob walks with his own stake

        uint256 before = usdc.balanceOf(alice);
        vm.prank(server);
        stake.settle(MATCH, alice, "root");

        assertEq(usdc.balanceOf(alice) - before, STAKE);
        assertEq(usdc.balanceOf(address(stake)), 0);
    }

    // --- Admin --------------------------------------------------------------------

    function test_setServer_rotatesAuthority() public {
        address next = makeAddr("next");
        vm.prank(server);
        stake.setServer(next);
        assertEq(stake.server(), next);

        _open();
        vm.prank(server);
        vm.expectRevert(ChaseStake.NotServer.selector);
        stake.settle(MATCH, alice, "root");

        vm.prank(next);
        stake.settle(MATCH, alice, "root");
    }

    function test_nonServerCannotRotate_reverts() public {
        vm.prank(alice);
        vm.expectRevert(ChaseStake.NotServer.selector);
        stake.setServer(alice);
    }

    function test_constructorRejectsZeroServer() public {
        vm.expectRevert(ChaseStake.ZeroAddress.selector);
        new ChaseStake(address(0));
    }

    // --- Invariant-ish ------------------------------------------------------------

    /// Whatever the stake, escrow holds exactly the pot and empties on settle.
    function testFuzz_escrowBalanceMatchesPot(uint96 amount, uint8 extra) public {
        amount = uint96(bound(amount, 1, 10e6));
        uint256 joiners = bound(extra, 0, 3);

        vm.prank(alice);
        stake.createMatch(MATCH, amount);

        address[3] memory others = [bob, carol, agent];
        for (uint256 i = 0; i < joiners; i++) {
            vm.prank(others[i]);
            stake.join(MATCH);
        }

        (,, uint256 pot,,,) = stake.getMatch(MATCH);
        assertEq(pot, amount * (joiners + 1));
        assertEq(usdc.balanceOf(address(stake)), pot);

        vm.prank(server);
        stake.settle(MATCH, alice, "root");
        assertEq(usdc.balanceOf(address(stake)), 0);
    }
}
