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

import Zemu, { zondaxMainmenuNavigation, DEFAULT_START_OPTIONS, ButtonKind, isTouchDevice } from '@zondax/zemu'
// @ts-ignore
import AlgorandApp, { ScopeType, StdSigData, HDWalletMetadata } from '@zondax/ledger-algorand'
import { APP_SEED, models, APPLICATION_TEST_CASES, txAssetConfig, txAssetFreeze, txAssetXfer, txKeyreg, txPayment } from './common'

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

jest.setTimeout(300000)

describe('Arbitrary Sign', function () {
  test.concurrent.each(models)('arbitrary sign', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData: Uint8Array = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest: StdSigData = {
        data: Buffer.from('eyJjaGFsbGVuZ2UiOiJlU1pWc1ltdk5DakpHSDVhOVdXSWpLcDVqbTVERnhsd0JCQXc5emM4RlpNPSIsIm9yaWdpbiI6Imh0dHBzOi8vYXJjNjAuaW8iLCJ0eXBlIjoiYXJjNjAuY3JlYXRlIn0').toString(),
        signer: pubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(2)).toString('base64'),
        authenticationData: authData,
        hdPath: "m/44'/60'/0'/0/0"
      }

      // do not wait here.. we need to navigate
      const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_arbitrary`)

      const signatureResponse = await signatureRequest

      let decodedData = Buffer.from(authRequest.data, 'base64');

      let clientDataJson = JSON.parse(decodedData.toString());

      const canonifiedClientDataJson = canonify(clientDataJson);
      if (!canonifiedClientDataJson) {
        throw new Error('Wrong JSON');
      }

      const clientDataJsonHash: Buffer = crypto.createHash('sha256').update(canonifiedClientDataJson).digest();
      const authenticatorDataHash: Buffer = crypto.createHash('sha256').update(authRequest.authenticationData).digest();
      const toSign = Buffer.concat([clientDataJsonHash, authenticatorDataHash])


      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), toSign])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })
})
