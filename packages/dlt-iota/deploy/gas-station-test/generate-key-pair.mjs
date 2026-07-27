// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable no-console */
import { Converter } from '@twin.org/core';
import { Bip39, Bip44, Ed25519, KeyType, Blake2b } from '@twin.org/crypto';

const mnemonic = Bip39.randomMnemonic();

console.log('Mnemonic:', mnemonic);

const seed = Bip39.mnemonicToSeed(mnemonic);
console.log('Seed (Hex):', Converter.bytesToHex(seed));

const coinType = 4218; // IOTA coin type
const accountIndex = 0;
const internal = false;
const i = 0;

const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, coinType, accountIndex, internal, i);

const gasStationPublicKey = Ed25519.publicKeyFromPrivateKey(keyPair.privateKey);

const gasStationPrivateKey = new Uint8Array(keyPair.privateKey.length + 1);
gasStationPrivateKey[0] = 0x00; // Add a leading 0x00 byte to indicate it's a private key
gasStationPrivateKey.set(keyPair.privateKey, 1);

console.log('Gas Station Private Key (Base64):', Converter.bytesToBase64(gasStationPrivateKey));
console.log('Gas Station Public Key (Base64):', Converter.bytesToBase64(gasStationPublicKey));

console.log(
	'Gas Station Address for Funding (Hex):',
	Converter.bytesToHex(Blake2b.sum256(gasStationPublicKey), true)
);
