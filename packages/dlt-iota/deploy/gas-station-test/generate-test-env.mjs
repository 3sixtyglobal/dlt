// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable no-console */
import { Converter } from '@3sixty/core';
import { Bip39, Bip44, Ed25519, KeyType, Blake2b } from '@3sixty/crypto';

const coinType = 4218; // IOTA coin type

/**
 * Derive the first address key pair for a mnemonic.
 * @param mnemonic The mnemonic to derive from.
 * @returns The private key, public key and address.
 */
function deriveAccount(mnemonic) {
	const seed = Bip39.mnemonicToSeed(mnemonic);
	const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, coinType, 0, false, 0);
	const publicKey = Ed25519.publicKeyFromPrivateKey(keyPair.privateKey);
	return {
		privateKey: keyPair.privateKey,
		publicKey,
		address: Converter.bytesToHex(Blake2b.sum256(publicKey), true)
	};
}

const mnemonics = {
	TEST: Bip39.randomMnemonic(),
	TEST_2: Bip39.randomMnemonic(),
	TEST_NODE: Bip39.randomMnemonic(),
	TEST_DEPLOYER: Bip39.randomMnemonic()
};

// Use the gas station mnemonic from the command line if provided, otherwise generate a random one
const gasStationMnemonic = process.argv[2]?.trim() || Bip39.randomMnemonic();
const gasStation = deriveAccount(gasStationMnemonic);

const gasStationPrivateKey = new Uint8Array(gasStation.privateKey.length + 1);
gasStationPrivateKey[0] = 0x00; // Add a leading 0x00 byte to indicate it's a private key
gasStationPrivateKey.set(gasStation.privateKey, 1);

console.log('TEST_NODE_ENDPOINT="https://api.testnet.iota.cafe"');
console.log('TEST_EXPLORER_URL="https://explorer.iota.org/"');
console.log('TEST_NETWORK="testnet"');
for (const [prefix, mnemonic] of Object.entries(mnemonics)) {
	console.log(`${prefix}_MNEMONIC=${mnemonic}`);
	console.log(`${prefix}_ADDRESS="${deriveAccount(mnemonic).address}"`);
}
console.log(`TEST_GAS_STATION_MNEMONIC=${gasStationMnemonic}`);
console.log(`TEST_GAS_STATION_KEYPAIR="${Converter.bytesToBase64(gasStationPrivateKey)}"`);
console.log(`TEST_GAS_STATION_ADDRESS="${gasStation.address}"`);
