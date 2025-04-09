/** ******************************************************************************
 *  (c) 2018 - 2025 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */

import { describe, test, expect, beforeAll } from 'vitest'
import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'
// @ts-ignore
import { AlgorandApp, ScopeType, StdSigData } from '@zondax/ledger-algorand'
import { APP_SEED, models, ARBITRARY_SIGN_TEST_CASES } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'

import { canonify } from '@truestamp/canonify';
import * as crypto from 'crypto'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

beforeAll(() => {
  // This is handled by the vitest.config.ts file
})

describe('Arbitrary Sign', () => {
  describe.each(ARBITRARY_SIGN_TEST_CASES)('Tx Arbitrary Sign', (params) => {
    test.each(models)('arbitrary sign', async (m) => {
      const sim = new Zemu(m.path)
      try {
        await sim.start({ ...defaultOptions, model: m.name })
        const app = new AlgorandApp(sim.getTransport())

        const responseAddr = await app.getAddressAndPubKey()
        const pubKey = responseAddr.publicKey

        const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

        const authRequest: StdSigData = {
          data: Buffer.from(params.data).toString('base64'),
          signer: pubKey,
          domain: "arc60.io",
          requestId: Buffer.from(Array(32).fill(0x41)).toString('base64'),
          authenticationData: authData,
          hdPath: "m/44'/283'/0'/0/0"
        }

        // do not wait here.. we need to navigate
        const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

        // Wait until we are not in the main menu
        await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
        await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary-${params.idx}`)

        const signatureResponse = await signatureRequest

        const toSign = buildToSign(authRequest)

        // Now verify the signature
        const valid = ed25519.verify(signatureResponse.signature, toSign, pubKey)
        expect(valid).toBe(true)
      } finally {
        await sim.close()
      }
    })
  })

  test.each(models)('arbitrary sign - derive hdpath', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      let accountId = 2

      const firstResponseAddr = await app.getAddressAndPubKey(accountId)
      const firstPubKey = firstResponseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      let authRequest: StdSigData = {
        data: Buffer.from('{ "type": "arc60.create", "challenge": "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", "origin": "https://arc60.io" }').toString('base64'),
        signer: firstPubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(0x41)).toString('base64'),
        authenticationData: authData,
        hdPath: `m/44'/283'/${accountId}'/0/0`
      }

      // do not wait here.. we need to navigate
      const firstSignatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary-derive-hdpath`)

      const signatureForAccountId2 = await firstSignatureRequest

      let toSign = buildToSign(authRequest)

      // Now verify the signature
      let valid = ed25519.verify(signatureForAccountId2.signature, toSign, firstPubKey)
      expect(valid).toBe(true)

      let signatureForAccountId0 = Buffer.from("e8ef89c60790bc217a69e0b47fa35119b831e9fd7beb3c4219df2206c5d65d1a59691c7107dd0c0fe03c53a9e2faaf78a47d65d40cdab395bba88395e68f5a04", "hex")

      expect(signatureForAccountId0).not.toBe(signatureForAccountId2.signature)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - no hdpath', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from('{ "type": "arc60.create", "challenge": "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", "origin": "https://arc60.io" }').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(0x41)).toString('base64'),
        authenticationData: authData,
      }

      // do not wait here.. we need to navigate
      const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary-no-hdpath`)

      const signatureResponse = await signatureRequest

      const toSign = buildToSign(authRequest)

      // Now verify the signature
      const valid = ed25519.verify(signatureResponse.signature, toSign, pubKey)
      expect(valid).toBe(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - no requestId', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from('{ "type": "arc60.create", "challenge": "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", "origin": "https://arc60.io" }').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      // do not wait here.. we need to navigate
      const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary-no-requestId`)

      const signatureResponse = await signatureRequest

      const toSign = buildToSign(authRequest)

      // Now verify the signature
      const valid = ed25519.verify(signatureResponse.signature, toSign, pubKey)
      expect(valid).toBe(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - no hd path and no requestId', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from('{ "type": "arc60.create", "challenge": "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", "origin": "https://arc60.io" }').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
      }

      // do not wait here.. we need to navigate
      const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary-no-hdpath-no-requestId`)

      const signatureResponse = await signatureRequest

      const toSign = buildToSign(authRequest)

      // Now verify the signature
      const valid = ed25519.verify(signatureResponse.signature, toSign, pubKey)
      expect(valid).toBe(true)
    } finally {
      await sim.close()
    }
  })
})

function buildToSign(authRequest: StdSigData) {
  let decodedData = Buffer.from(authRequest.data, 'base64');

  let clientDataJson = JSON.parse(decodedData.toString());

  const canonifiedClientDataJson = canonify(clientDataJson);
  if (!canonifiedClientDataJson) {
    throw new Error('Wrong JSON');
  }

  const clientDataJsonHash: Buffer = crypto.createHash('sha256').update(canonifiedClientDataJson).digest();
  const authenticatorDataHash: Buffer = crypto.createHash('sha256').update(authRequest.authenticationData).digest();
  const toSign = Buffer.concat([clientDataJsonHash, authenticatorDataHash])
  return toSign
}
