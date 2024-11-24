// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Counters
 * @dev Provides counters that can only be incremented, decremented, or reset.
 * This can be used for counting IDs, token supply, or anything else.
 */
library Counters {
    struct Counter {
        // This variable should never be accessed directly by users of the library:
        // interaction should be restricted to the library's functions.
        uint256 _value; // Default: 0
    }

    /**
     * @dev Returns the current value of the counter.
     * @param counter - the Counter struct being used.
     */
    function current(Counter storage counter) internal view returns (uint256) {
        return counter._value;
    }

    /**
     * @dev Increments the counter by 1.
     * @param counter - the Counter struct being used.
     */
    function increment(Counter storage counter) internal {
        unchecked {
            counter._value += 1;
        }
    }

    /**
     * @dev Decrements the counter by 1.
     * Requires that the counter's value is greater than zero.
     * @param counter - the Counter struct being used.
     */
    function decrement(Counter storage counter) internal {
        uint256 value = counter._value;
        require(value > 0, "Counter: decrement overflow");
        unchecked {
            counter._value = value - 1;
        }
    }

    /**
     * @dev Resets the counter to 0.
     * @param counter - the Counter struct being used.
     */
    function reset(Counter storage counter) internal {
        counter._value = 0;
    }
}
