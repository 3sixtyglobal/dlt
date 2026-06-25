// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";

/**
 * Clean build artifacts (Move.lock and build directory) in a specific path.
 * @param contractPath Path to the contract directory to clean.
 * @returns Promise that resolves when cleanup is complete.
 */
export async function cleanBuildArtifactsInPath(contractPath: string): Promise<void> {
	// Clean Move.lock if it exists
	const moveLockPath = path.join(contractPath, "Move.lock");
	try {
		await fsPromises.unlink(moveLockPath);
	} catch {
		// Move.lock doesn't exist, which is expected
	}

	// Clean build directory if it exists
	const buildPath = path.join(contractPath, "build");
	try {
		await fsPromises.rm(buildPath, { recursive: true, force: true });
	} catch {
		// Build directory doesn't exist, which is expected
	}
}
