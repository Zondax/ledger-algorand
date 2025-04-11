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

// @ts-ignore
import Zemu, { zondaxMainmenuNavigation, DEFAULT_START_OPTIONS, ButtonKind, isTouchDevice } from '@zondax/zemu'
// @ts-ignore
import { AlgorandApp } from '@zondax/ledger-algorand'
import { APP_SEED, models, txApplication, txAssetConfig, txAssetFreeze, txAssetXfer, txKeyreg, txPayment } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import { errorCodeToString, LedgerError } from '@zondax/ledger-algorand/dist/common'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

const accountId = 123

beforeEach(() => {
  // This is handled by the vitest.config.ts file
})

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

      console.log(resp)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))
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

      const tmpAccountId = 123
      const resp = await app.getAddressAndPubKey(tmpAccountId)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

      const expected_pk = '0dfdbcdb8eebed628cfb4ef70207b86fd0deddca78e90e8c59d6f441e383b377'
      const expected_address = 'BX63ZW4O5PWWFDH3J33QEB5YN7IN5XOKPDUQ5DCZ232EDY4DWN3XKUQRCA'

      expect(resp.publicKey.toString('hex')).toEqual(expected_pk)
      expect(resp.address.toString()).toEqual(expected_address)
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

      const tmpAccountId = 123
      const resp = await app.getPubkey(tmpAccountId)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

      const expected_pk = '0dfdbcdb8eebed628cfb4ef70207b86fd0deddca78e90e8c59d6f441e383b377'
      expect(resp.publicKey.toString('hex')).toEqual(expected_pk)
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

      const respRequest = app.getAddressAndPubKey(accountId, true)
      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-show_address`)

      const resp = await respRequest

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))
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
        rejectKeyword: isTouchDevice(m.name) ? 'Confirm' : '',
      })
      const app = new AlgorandApp(sim.getTransport())

      // Create a promise that should be rejected
      const respRequest = app.getAddressAndPubKey(accountId, true)
      
      expect(respRequest).rejects.toMatchObject({
        returnCode: LedgerError.TransactionRejected,
        errorMessage: errorCodeToString(LedgerError.TransactionRejected),
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
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_freeze`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

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
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_transfer`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

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
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_config`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

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
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_keyreg`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

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
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_payment`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign application normal', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlob = Buffer.from(txApplication)
      console.log(sim.getMainMenuSnapshot())
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequest = app.sign(accountId, txBlob)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_application_normal`)

      const signatureResponse = await signatureRequest

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      // Now verify the signature
      const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('sign asset freeze and sign application', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const txBlobAssetFreeze = Buffer.from(txAssetFreeze)
      const responseAddr = await app.getAddressAndPubKey(accountId)
      const pubKey = responseAddr.publicKey

      // do not wait here.. we need to navigate
      const signatureRequestAssetFreeze = app.sign(accountId, txBlobAssetFreeze)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      const lastSnapshotIdx = await sim.navigateUntilText(
        '.',
        `${m.prefix.toLowerCase()}-sign_asset_freeze_and_application`,
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
        await sim.takeSnapshotAndOverwrite('.', `${m.prefix.toLowerCase()}-sign_asset_freeze_and_application`, lastSnapshotIdx);
      }

      await sim.compareSnapshots('.', `${m.prefix.toLowerCase()}-sign_asset_freeze_and_application`, lastSnapshotIdx);

      const signatureResponseAssetFreeze = await signatureRequestAssetFreeze

      expect(signatureResponseAssetFreeze.returnCode).toEqual(0x9000)
      expect(signatureResponseAssetFreeze.errorMessage).toEqual(errorCodeToString(LedgerError.NoErrors))

      // Now verify the signature
      const prehashAssetFreeze = Buffer.concat([Buffer.from('TX'), txBlobAssetFreeze])
      const validAssetFreeze = ed25519.verify(signatureResponseAssetFreeze.signature, prehashAssetFreeze, pubKey)
      expect(validAssetFreeze).toEqual(true)

      await sim.deleteEvents()

      const txBlobApplication = Buffer.from(txApplication)
      console.log(sim.getMainMenuSnapshot())

      // do not wait here.. we need to navigate
      const signatureRequestApplication = app.sign(accountId, txBlobApplication)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_asset_freeze_and_application`, true, lastSnapshotIdx + 1)

      const signatureResponseApplication = await signatureRequestApplication

      expect(signatureResponseApplication.return_code).toEqual(0x9000)
      expect(signatureResponseApplication.error_message).toEqual('No errors')

      // Now verify the signature
      const prehashApplication = Buffer.concat([Buffer.from('TX'), txBlobApplication])
      const validApplication = ed25519.verify(signatureResponseApplication.signature, prehashApplication, pubKey)
      expect(validApplication).toEqual(true)
    } finally {
      await sim.close()
    }
  })
})