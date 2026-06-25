// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
module test_contract::simple_counter {

    /// Version 1 of the test contract
    const VERSION: u64 = 1;

    /// Simple counter for testing upgrade functionality
    public struct Counter has key {
        id: UID,
        value: u64,
        version: u64,
    }

    /// Admin capability for testing
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Initialize the contract by creating and transferring AdminCap to deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {id: object::new(ctx),};
        transfer::transfer(admin_cap, ctx.sender());
    }

    /// Create a new counter with initial value 0
    public fun create_counter(ctx: &mut TxContext): Counter {
        Counter {
            id: object::new(ctx),
            value: 0,
            version: VERSION,
        }
    }

    /// Increment counter value by 1
    public fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }

    /// Get the contract version
    public fun get_version(): u64 {
         VERSION
    }

    /// Get the counter version (for migration tracking)
    public fun get_counter_version(counter: &Counter): u64 {
        counter.version
    }

    /// Get the current counter value
    public fun get_value(counter: &Counter): u64 {
        counter.value
    }
}
