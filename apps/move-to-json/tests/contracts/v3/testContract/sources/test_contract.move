// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
module test_contract::simple_counter {

    /// Version 3 of the test contract - Added reset functionality
    const VERSION: u64 = 3;

    /// Counter struct kept identical to V1 to satisfy upgrade compatibility rules.
    /// Move does not allow adding fields to existing structs across upgrades.
    public struct Counter has key {
        id: UID,
        value: u64,
        version: u64,
    }

    /// Admin capability for testing
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Separate config object to hold step size without changing Counter layout.
    public struct CounterConfig has key, store {
        id: UID,
        step_size: u64,
    }

    /// Initialize the contract by creating and transferring AdminCap to deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
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

    /// Create a counter config with a custom step size
    public fun create_counter_config(step_size: u64, ctx: &mut TxContext): CounterConfig {
        CounterConfig {
            id: object::new(ctx),
            step_size,
        }
    }

    /// Increment counter value by 1
    public fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }

    /// Increment counter value by the step size in a config object
    public fun increment_by_step(counter: &mut Counter, config: &CounterConfig) {
        counter.value = counter.value + config.step_size;
    }

    /// Update step size in a config object
    public fun set_step_size(config: &mut CounterConfig, step: u64) {
        config.step_size = step;
    }

    /// NEW in V3: Reset counter value to zero
    public fun reset(counter: &mut Counter) {
        counter.value = 0;
        counter.version = VERSION;
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

    /// Get the step size from a config object
    public fun get_step_size(config: &CounterConfig): u64 {
        config.step_size
    }
}
