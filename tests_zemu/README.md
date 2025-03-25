# Ledger Algorand Tests

This directory contains integration tests for the Algorand Ledger application using Vitest and Bun.

## Setup

```bash
# Install dependencies
bun install
```

## Running Tests

```bash
# Run all tests
bun test

# Clean containers and run tests
bun run clean && bun test
```

## Configuration

- `vitest.config.ts` - Vitest configuration file
- `bunfig.toml` - Bun configuration file
- `globalsetup.js` - Setup file that runs before tests

## Development

The tests simulate interaction with the Ledger device through [Zemu](https://github.com/Zondax/zemu), a Ledger emulator.
