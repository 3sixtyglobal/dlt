// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
module test_contract::simple_counter {
    use std::string::String;

    /// Version 2 of the test contract - Enhanced with step size
    const VERSION: u64 = 2;

    /// Enhanced counter with additional features in V2
    public struct Counter has key {
        id: UID,
        value: u64,
        version: u64,
        step_size: u64,  // NEW: Configurable increment step
    }

    /// Admin capability for testing
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Initialize the contract by creating and transferring AdminCap to deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());
    }

    /// Create a new counter with initial value 0 and default step size
    public fun create_counter(ctx: &mut TxContext): Counter {
        Counter {
            id: object::new(ctx),
            value: 0,
            version: VERSION,
            step_size: 1,  // NEW: Default step size
        }
    }

    /// Increment counter value by the configured step size
    public fun increment(counter: &mut Counter) {
        counter.value = counter.value + counter.step_size;  // NEW: Use step size
    }

    /// NEW: Set custom step size for increments
    public fun set_step_size(counter: &mut Counter, step: u64) {
        counter.step_size = step;
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

    /// NEW: Get the current step size
    public fun get_step_size(counter: &Counter): u64 {
        counter.step_size
    }
}