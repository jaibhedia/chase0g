// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChaseStake} from "../src/ChaseStake.sol";

/**
 * Deploy ChaseStake to Arc. Same script for testnet and mainnet — only the RPC differs,
 * which is what makes the A6 "push to mainnet" step a one-liner.
 *
 *   Testnet:
 *     forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
 *
 *   Mainnet (chain 5042, deadline Sep 30):
 *     forge script script/Deploy.s.sol --rpc-url arc_mainnet --broadcast
 *
 * Env:
 *   ARC_PRIVATE_KEY  deployer key (also the default settlement server)
 *   ARC_SERVER       optional; settlement authority if it differs from the deployer
 */
contract Deploy is Script {
    /**
     * Read the deployer key, tolerating a bare 64-char hex key without the "0x"
     * prefix. `vm.envUint` alone rejects that with a confusing parse error, and
     * pasting a key without the prefix is the easiest mistake to make here.
     */
    function _deployerKey() internal view returns (uint256) {
        string memory raw = vm.envString("ARC_PRIVATE_KEY");
        bytes memory b = bytes(raw);

        if (b.length == 64) {
            raw = string.concat("0x", raw);
        } else if (!(b.length == 66 && b[0] == "0" && (b[1] == "x" || b[1] == "X"))) {
            revert("ARC_PRIVATE_KEY must be a 64-character hex key, with or without a 0x prefix");
        }
        return vm.parseUint(raw);
    }

    function run() external returns (ChaseStake deployed) {
        uint256 pk = _deployerKey();
        address server = vm.envOr("ARC_SERVER", vm.addr(pk));

        console.log("chain id   ", block.chainid);
        console.log("deployer   ", vm.addr(pk));
        console.log("server     ", server);

        vm.startBroadcast(pk);
        deployed = new ChaseStake(server);
        vm.stopBroadcast();

        console.log("ChaseStake ", address(deployed));
        console.log("Set ARC_CHASESTAKE_ADDRESS to the address above.");
    }
}
