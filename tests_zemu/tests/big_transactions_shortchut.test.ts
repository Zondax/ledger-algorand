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

import { describe, test, expect, beforeEach } from 'vitest'
import Zemu, { DEFAULT_START_OPTIONS, ClickNavigation } from '@zondax/zemu'
// @ts-ignore
import { AlgorandApp } from '@zondax/ledger-algorand'
import { APP_SEED, clickableModels, txApplicationLong } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

const accountId = 123

describe('BigTransactions - Shortcut', () => {
  beforeEach(context => {
    // This is handled by the vitest.config.ts file
  })

  test.concurrent('can start and stop container', async ({ expect }) => {
    for (const m of clickableModels) {
      const sim = new Zemu(m.path)
      try {
        await sim.start({ ...defaultOptions, model: m.name })
      } finally {
        await sim.close()
      }
    }
  })

  test.concurrent('sign application big', async ({ expect }) => {
    for (const m of clickableModels) {
      const sim = new Zemu(m.path)
      try {
        await sim.start({ ...defaultOptions, model: m.name })
        const app = new AlgorandApp(sim.getTransport())

        const txBlob = Buffer.from(txApplicationLong, 'hex')
        console.log(sim.getMainMenuSnapshot())

        // Enable expert mode
        await sim.toggleExpertMode(`${m.prefix.toLowerCase()}-sign_application_big_shortcut`, true, 0);

        // Toggle shortcut mode on nano s, s+ and x devices, and compare
        const snapshotsDelta = m.name == "nanos" ? 3 : 0
        let nav = new ClickNavigation([2, 0, 5 + snapshotsDelta, 0])
        await sim.navigateAndCompareSnapshots(".", `${m.prefix.toLowerCase()}-sign_application_big_shortcut`, nav.schedule, true, 3);

        // Take snapshots of the shortcut mode and compare
        nav = new ClickNavigation([2, -2])
        await sim.navigateAndCompareSnapshots(".", `${m.prefix.toLowerCase()}-sign_application_big_shortcut`, nav.schedule, true, 12 + snapshotsDelta);

        console.log(sim.getMainMenuSnapshot())
        const responseAddr = await app.getAddressAndPubKey(accountId)
        const pubKey = responseAddr.publicKey

        await sim.deleteEvents()

        // do not wait here.. we need to navigate
        const signatureRequest = app.sign(accountId, txBlob)

        // Wait until we are not in the main menu
        await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

        // Click on "skip fields" and approve
        nav = new ClickNavigation([1, 0, 0])
        await sim.navigateAndCompareSnapshots(".", `${m.prefix.toLowerCase()}-sign_application_big_shortcut`, nav.schedule, true, 17 + snapshotsDelta);

        const signatureResponse = await signatureRequest
        console.log(signatureResponse)

        expect(signatureResponse.return_code).toEqual(0x9000)
        expect(signatureResponse.error_message).toEqual('No errors')

        // Now verify the signature
        const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
        const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
        expect(valid).toEqual(true)
      } finally {
        await sim.close()
      }
    }
  })
})
