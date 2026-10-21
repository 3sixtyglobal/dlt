// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable no-console */
import { Converter } from '@3sixty/core';
import { Bip39, Bip44, Ed25519, KeyType, Blake2b } from '@3sixty/crypto';

const coinType = 4218; // IOTA coin type

// Use the gas station mnemonic from the command line if provided, otherwise generate a random one
const gasStationMnemonic = process.argv[2]?.trim() || Bip39.randomMnemonic();

const seed = Bip39.mnemonicToSeed(gasStationMnemonic);
const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, coinType, 0, false, 0);

const gasStationPublicKey = Ed25519.publicKeyFromPrivateKey(keyPair.privateKey);

const gasStationPrivateKey = new Uint8Array(keyPair.privateKey.length + 1);
gasStationPrivateKey[0] = 0x00; // Add a leading 0x00 byte to indicate it's a private key
gasStationPrivateKey.set(keyPair.privateKey, 1);

console.log('TEST_NODE_ENDPOINT="https://api.testnet.iota.cafe"');
console.log('TEST_EXPLORER_URL="https://explorer.iota.org/"');
console.log('TEST_NETWORK="testnet"');
console.log(`TEST_MNEMONIC=${Bip39.randomMnemonic()}`);
console.log(`TEST_2_MNEMONIC=${Bip39.randomMnemonic()}`);
console.log(`TEST_NODE_MNEMONIC=${Bip39.randomMnemonic()}`);
console.log(`TEST_DEPLOYER_MNEMONIC=${Bip39.randomMnemonic()}`);
console.log(`TEST_GAS_STATION_MNEMONIC=${gasStationMnemonic}`);
console.log(`TEST_GAS_STATION_KEYPAIR="${Converter.bytesToBase64(gasStationPrivateKey)}"`);
console.log(
	`TEST_GAS_STATION_ADDRESS="${Converter.bytesToHex(Blake2b.sum256(gasStationPublicKey), true)}"`
);
