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

import Zemu, { zondaxMainmenuNavigation, DEFAULT_START_OPTIONS, ButtonKind, isTouchDevice } from '@zondax/zemu'
// @ts-ignore
import { AlgorandApp } from '@zondax/ledger-algorand'
import { APP_SEED, models, APPLICATION_TEST_CASES, txAssetConfig, txAssetFreeze, txAssetXfer, txKeyreg, txPayment } from './common'

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

jest.setTimeout(300000)

describe('Standard', function () {
  test.concurrent.each(models)('can start and stop container', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('main menu', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const nav = zondaxMainmenuNavigation(m.name, [1, 0, 0, 5, -6])
      await sim.navigateAndCompareSnapshots('.', `${m.prefix.toLowerCase()}-mainmenu`, nav.schedule)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('get app version', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())
      const resp = await app.getVersion()

      expect(resp).toHaveProperty('testMode')
      expect(resp).toHaveProperty('major')
      expect(resp).toHaveProperty('minor')
      expect(resp).toHaveProperty('patch')
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('get address', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const resp = await app.getAddressAndPubKey(hdPath)

      const expected_pk = '0dfdbcdb8eebed628cfb4ef70207b86fd0deddca78e90e8c59d6f441e383b377'
      const expected_address = 'BX63ZW4O5PWWFDH3J33QEB5YN7IN5XOKPDUQ5DCZ232EDY4DWN3XKUQRCA'

      expect(resp.pubkey.toString('hex')).toEqual(expected_pk)
      expect(resp.address).toEqual(expected_address)
    } finally {
      await sim.close()
    }
  })

  // Legacy
  test.concurrent.each(models)('get pubkey', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const resp = await app.getPubkey(hdPath)

      const expected_pk = '0dfdbcdb8eebed628cfb4ef70207b86fd0deddca78e90e8c59d6f441e383b377'
      expect(resp.pubkey.toString('hex')).toEqual(expected_pk)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('show address', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({
        ...defaultOptions,
        model: m.name,
        approveKeyword: isTouchDevice(m.name) ? 'Confirm' : '',
        approveAction: ButtonKind.DynamicTapButton,
      })
      const app = new AlgorandApp(sim.getTransport())

      const respRequest = app.getAddressAndPubKey(hdPath, true)
      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-show_address`)

      const resp = await respRequest
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('show address - reject', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({
        ...defaultOptions,
        model: m.name,
        approveKeyword: isTouchDevice(m.name) ? 'Confirm' : '',
        approveAction: ButtonKind.ApproveTapButton,
      })
      const app = new AlgorandApp(sim.getTransport())

      const respRequest = app.getAddressAndPubKey(hdPath, true)

      expect(respRequest).rejects.toMatchObject({
        returnCode: 0x6986,
        errorMessage: 'Transaction rejected',
      })

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndReject('.', `${m.prefix.toLowerCase()}-show_address_reject`)

    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign asset freeze normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetFreeze)
      const responseAddr = await app.getAddressAndPubKey(hdPath)
      const pubKey = responseAddr.pubkey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(hdPath, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_freeze`)

      const signatureResponse = await signatureRequest

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign asset transfer normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetXfer)
      const responseAddr = await app.getAddressAndPubKey(hdPath)
      const pubKey = responseAddr.pubkey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(hdPath, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_transfer`)

      const signatureResponse = await signatureRequest

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign asset config normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txAssetConfig)
      const responseAddr = await app.getAddressAndPubKey(hdPath)
      const pubKey = responseAddr.pubkey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(hdPath, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_config`)

      const signatureResponse = await signatureRequest

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign keyreg normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txKeyreg)
      const responseAddr = await app.getAddressAndPubKey(hdPath)
      const pubKey = responseAddr.pubkey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(hdPath, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_keyreg`)

      const signatureResponse = await signatureRequest

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign payment normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txPayment)
      const responseAddr = await app.getAddressAndPubKey(hdPath)
      const pubKey = responseAddr.pubkey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(hdPath, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_payment`)

      const signatureResponse = await signatureRequest

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  describe.each(APPLICATION_TEST_CASES)('Tx Application Calls', function (data) {
    test.concurrent.each(models)(`sign_application_normal_${data.name}`, async function (m) {
      const sim = new Zemu(m.path)
      try {
        await sim.start({ ...defaultOptions, model: m.name })
        const app = new AlgorandApp(sim.getTransport())

        const txBlob = Buffer.from(data.tx)
        const responseAddr = await app.getAddressAndPubKey(hdPath)
        const pubKey = responseAddr.pubkey

        if (data.blindsign_mode) {
          await sim.toggleBlindSigning()
        }

        // do not wait here.. we need to navigate
        const signatureRequest = app.sign(hdPath, txBlob)

        // Wait until we are not in the main menu
        await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
        await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_application_normal_${data.name}`,true, 0, 15000, data.blindsign_mode)

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