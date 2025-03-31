/** ******************************************************************************
 *  (c) 2018 - 2022 Zondax AG
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

import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'
// @ts-ignore
import { AlgorandApp } from '@zondax/ledger-algorand'
import { APP_SEED, models, APPLICATION_LONG_TEST_CASES, txApplicationLong } from './common'
import { expect, test, describe, beforeEach } from 'vitest'

// @ts-ignore
import ed25519 from 'ed25519-supercop'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

const accountId = 123
const hdPath = `m/44'/283'/${accountId}'/0/0`

// Timeout is now handled in vitest.config.ts
beforeEach(() => {
  // This is handled by the vitest.config.ts file
})

describe('BigTransactions', function () {
  test.concurrent.each(models)('can start and stop container', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
    } finally {
      await sim.close()
    }
  })

  describe.each(APPLICATION_LONG_TEST_CASES)('Tx Application Calls', function (data) {
    test.concurrent.each(models)(`sign_application_big_${data.name}`, async function (m) {
      const sim = new Zemu(m.path)
      try {
        await sim.start({ ...defaultOptions, model: m.name })
        const app = new AlgorandApp(sim.getTransport())

        const txBlob = Buffer.from(data.tx, 'hex')

        const responseAddr = await app.getAddressAndPubKey(hdPath)
        const pubKey = responseAddr.pubkey

        if (data.blindsign_mode) {
          await sim.toggleBlindSigning()
        }

        // do not wait here.. we need to navigate
        const signatureRequest = app.sign(hdPath, txBlob)

        // Wait until we are not in the main menu
        await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
        await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_application_big_${data.name}`,true, 0, 15000, data.blindsign_mode)

        const signatureResponse = await signatureRequest

        // Now verify the signature
        const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
        const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
        expect(valid).toEqual(true)
      } finally {
        await sim.close()
      }
    })
  })
})
