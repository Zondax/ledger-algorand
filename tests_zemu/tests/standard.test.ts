/** ******************************************************************************
 *  (c) 2020 Zondax GmbH
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
import AlgorandApp from '@zondax/ledger-algorand'
import { APP_SEED, models, txApplication, txAssetConfig, txAssetFreeze, txAssetXfer, txKeyreg, txPayment } from './common'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

// Derivation path. First 3 items are automatically hardened!
const accountId = 123


jest.setTimeout(60000)

beforeAll(async () => {
  await Zemu.checkAndPullImage()
})

describe('Standard', function () {
  // test.each(models)('can start and stop container', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //   } finally {
  //     await sim.close()
  //   }
  // })

  // test.each(models)('main menu', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //     await sim.navigateAndCompareSnapshots('.', `${m.prefix.toLowerCase()}-mainmenu`, [1, 0, 0, 4, -5])
  //   } finally {
  //     await sim.close()
  //   }
  // })

  // test.each(models)('get app version', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //     const app = new AlgorandApp(sim.getTransport())
  //     const resp = await app.getVersion()

  //     console.log(resp)

  //     expect(resp.return_code).toEqual(0x9000)
  //     expect(resp.error_message).toEqual('No errors')
  //     expect(resp).toHaveProperty('test_mode')
  //     expect(resp).toHaveProperty('major')
  //     expect(resp).toHaveProperty('minor')
  //     expect(resp).toHaveProperty('patch')
  //   } finally {
  //     await sim.close()
  //   }
  // })

  // test.each(models)('get address', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //     const app = new AlgorandApp(sim.getTransport())

  //     const resp = await app.getAddressAndPubKey(accountId)

  //     console.log(resp)

  //     expect(resp.return_code).toEqual(0x9000)
  //     expect(resp.error_message).toEqual('No errors')

  //     // const expected_address = '166wVhuQsKFeb7bd1faydHgVvX1bZU2rUuY7FJmWApNz2fQY'
  //     // const expected_pk = 'e1b4d72d27b3e91b9b6116555b4ea17138ddc12ca7cdbab30e2e0509bd848419'

  //     // expect(resp.address).toEqual(expected_address)
  //     // expect(resp.pubKey).toEqual(expected_pk)
  //   } finally {
  //     await sim.close()
  //   }
  // })

  // test.each(models)('show address', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //     const app = new AlgorandApp(sim.getTransport())

  //     const respRequest = app.getAddressAndPubKey(accountId, true)
  //     // Wait until we are not in the main menu
  //     await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
  //     await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-show_address`)

  //     const resp = await respRequest
  //     console.log(resp)

  //     expect(resp.return_code).toEqual(0x9000)
  //     expect(resp.error_message).toEqual('No errors')
  //   } finally {
  //     await sim.close()
  //   }
  // })

  // test.each(models)('show address - reject', async function (m) {
  //   const sim = new Zemu(m.path)
  //   try {
  //     await sim.start({ ...defaultOptions, model: m.name })
  //     const app = new AlgorandApp(sim.getTransport())

  //     const respRequest = app.getAddressAndPubKey(accountId, true)
  //     // Wait until we are not in the main menu
  //     await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

  //     await sim.navigateAndCompareUntilText('.', `${m.prefix.toLowerCase()}-show_address_reject`, 'REJECT')

  //     const resp = await respRequest
  //     console.log(resp)

  //     expect(resp.return_code).toEqual(0x6986)
  //     expect(resp.error_message).toEqual('Transaction rejected')
  //   } finally {
  //     await sim.close()
  //   }
  // })

  test.each(models)('sign asset freeze normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetFreeze)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_freeze`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign asset transfer normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetXfer)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_transfer`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign asset config normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetConfig)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_config`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign keyreg normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txKeyreg)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_keyreg`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign payment normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txPayment)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_payment`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign application normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txApplication)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)

      // const pubKey = Buffer.from(responseAddr.publicKey, 'hex')

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_application`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      //Replace verification with js-algorand-sdk npm package
      // Now verify the signature
      // let prehash = txBlob
      // if (txBlob.length > 256) {
      //   const context = blake2bInit(32)
      //   blake2bUpdate(context, txBlob)
      //   prehash = Buffer.from(blake2bFinal(context))
      // }
      // const valid = ed25519.verify(signatureResponse.signature.slice(1), prehash, pubKey)
      // expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

})
