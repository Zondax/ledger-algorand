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
import Zemu, { DEFAULT_START_OPTIONS , isTouchDevice } from '@zondax/zemu'
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
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", origin: "https://arc60.io" }) || '').toString('base64'),
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
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", origin: "https://arc60.io" }) || '').toString('base64'),
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
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", origin: "https://arc60.io" }) || '').toString('base64'),
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
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", origin: "https://arc60.io" }) || '').toString('base64'),
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

  test.each(models)('arbitrary sign - invalid scope', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      // Invalid scope type
      await expect(app.signData(authRequest, { scope: ScopeType.UNKNOWN, encoding: 'base64' })).rejects.toThrow('Invalid Scope')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - failed decoding', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'wrong_encoding' })).rejects.toThrow('Failed decoding')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - invalid signer', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const invalidPubKey = Buffer.from(Array(32).fill(1))
      
      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: invalidPubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Invalid Signer')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - missing domain', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        // domain is missing
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      } as any

      await expect(app.signData(authRequest as StdSigData, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Missing Domain')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - missing authenticated data', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        // authenticationData is missing
        hdPath: "m/44'/283'/0'/0/0"
      } as any

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Missing Authentication Data')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - bad JSON', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from('{ this is not valid JSON').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Bad JSON')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - failed domain auth', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      // Use an authData that doesn't match the domain
      const wrongAuthData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("wrong-domain.com").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: wrongAuthData,  // Auth data doesn't match domain
        hdPath: "m/44'/283'/0'/0/0"
      }

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Failed Domain Auth')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('arbitrary sign - failed hd path', async (m) => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "test", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        authenticationData: authData,
        hdPath: "m/44'/999'/0'/0/0"
      }

      await expect(app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })).rejects.toThrow('Failed HD Path')
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('arbitrary sign - multiple signatures', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const request1: StdSigData = {
        data: Buffer.from(canonify({ type: "arc60.create", challenge: "eSZVsYmvNCjJGH5a9WWIjKp5jm5DFxlwBBAw9zc8FZM=", origin: "https://arc60.io" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(0x41)).toString('base64'),
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      // do not wait here.. we need to navigate
      const signatureRequest1 = app.signData(request1, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      const lastSnapshotIdx = await sim.navigateUntilText(
        '.',
        `${m.prefix.toLowerCase()}-sign_arbitrary_multiple_signatures`,
        sim.startOptions.approveKeyword,
        true,
        true,
        0,
        15000,
        true,
        true,
        false
      );

      if (isTouchDevice(sim.startOptions.model)) {
        // Avoid taking a snapshot of the final animation
        await sim.waitUntilScreenIs(sim.mainMenuSnapshot);
        await sim.takeSnapshotAndOverwrite('.', `${m.prefix.toLowerCase()}-sign_arbitrary_multiple_signatures`, lastSnapshotIdx);
      }

      await sim.compareSnapshots('.', `${m.prefix.toLowerCase()}-sign_arbitrary_multiple_signatures`, lastSnapshotIdx);


      const signatureResponse1 = await signatureRequest1

      const toSign1 = buildToSign(request1)

      // Now verify the signature
      const valid1 = ed25519.verify(signatureResponse1.signature, toSign1, pubKey)
      expect(valid1).toBe(true)

      await sim.deleteEvents()

      const request2: StdSigData = {
        data: Buffer.from(canonify({ account_address: "BYVBFXCGJLDU5Q7POFA2G4CLAGUBWRU3TOKDPNQG57D44KW6CVY3FPIXRM", chain_id: "283", domain: "arc60.io", expiration_time: "2022-12-31T23:59:59Z", issued_at: "2021-12-31T23:59:59Z", nonce: "A4nEQYY3Ss9sCkTMwIIZui5VeUS5Y1HAQDK2+ivNtX8=", not_before: "2021-12-31T23:59:59Z", resources: ["auth", "sign"], statement: "We are requesting you to sign this message to authenticate to arc60.io", type: "ed25519", uri: "https://arc60.io", version: "1" }) || '').toString('base64'),
        signer: pubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(0x41)).toString('base64'),
        authenticationData: authData,
        hdPath: "m/44'/283'/0'/0/0"
      }

      // do not wait here.. we need to navigate
      const signatureRequest2 = app.signData(request2, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary_multiple_signatures`, true, lastSnapshotIdx + 1)

      const signatureResponse2 = await signatureRequest2

      const toSign2 = buildToSign(request2)

      // Now verify the signature
      const valid2 = ed25519.verify(signatureResponse2.signature, toSign2, pubKey)
      expect(valid2).toBe(true)
    } finally {
      await sim.close()
    }
  })
})

function buildToSign(authRequest: StdSigData) {
  let decodedData = Buffer.from(authRequest.data, 'base64');

  let clientDataJson = JSON.parse(decodedData.toString());

  const canonifiedClientDataJson = canonify(clientDataJson) || JSON.stringify(clientDataJson);
  if (!canonifiedClientDataJson) {
    throw new Error('Wrong JSON');
  }

  const clientDataJsonHash: Buffer = crypto.createHash('sha256').update(canonifiedClientDataJson).digest();
  const authenticatorDataHash: Buffer = crypto.createHash('sha256').update(authRequest.authenticationData).digest();
  const toSign = Buffer.concat([clientDataJsonHash, authenticatorDataHash])
  return toSign
}
