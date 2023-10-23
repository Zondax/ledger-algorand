/** ******************************************************************************
 *  (c) 2018 - 2023 Zondax AG
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
import Zemu, {DEFAULT_START_OPTIONS } from '@zondax/zemu'
// @ts-ignore
import AlgorandApp from '@zondax/ledger-algorand'
import  { APP_SEED, models } from './common'

import { hdKeyDerivation } from './key_derivation';

const bip39 = require("bip39");
const bip32ed25519 = require("bip32-ed25519");

const ALGO_PATH = 0x8000011B //283'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

jest.setTimeout(300000)
const inputs = [
  {
    mnemonic: 'lecture leopard sting margin search ticket million fitness index vehicle staff spot lunch disagree grief grab spider dismiss negative retreat voice orange degree hundred',
    accountId: 0,
    pubkey: 'ae1fe3a08857f17974d097d92a561e963743f6478075c856afdf0518db871c2d'
  },
  {
    mnemonic: 'exhibit tongue gym equip toilet afford tragic eager convince version resource fragile snake hope slim ask quick whisper upper invite umbrella priority stairs include',
    accountId: 5,
    pubkey: '7994821d2cd724328a4daae5cd98ee35a1c53a4cb5338fa5a001facdfd7979a1'
  },
  {
    mnemonic: 'beauty roof crazy man grid explain order list unlock volcano hip sauce fashion shaft hold honey process wool cluster thumb waste light subway word',
    accountId: 100,
    pubkey: '99a12ea8e7295a2b31c8abb10bf3cb34b7803a522f5a418b1571ae41da0e12ae'
  },
  {
    mnemonic: 'jelly liquid talk orient sketch elbow arm era abandon review belt pony mobile fetch behave fix spend drastic game laugh connect lizard risk forward',
    accountId: 10,
    pubkey: 'df06626e8f4c78ef46b776fc2498cf44228a72b60622122ea0dac26d523e4170'
  },
  {
    mnemonic: 'flower animal finger brown cube coffee over other cat taxi tide equip market soon outer worry slam donor jungle method large faint mansion sail',
    accountId: 50,
    pubkey: '8d111c46fae603940607db815ecb0bd18611edfb59160601acd4bdb129d9b89e'
  },
  {
    mnemonic: 'oil actual else mixture crash sunset tide absurd pistol fatigue era craft purity body hunt boy airport network fantasy enact tube dumb window tumble',
    accountId: 3,
    pubkey: '0472e4d37052849d8c2bf0e9a9d46b23f6318ae9a1c1edcbe844c7273ee08f8b'
  },
  {
    mnemonic: 'debris coral salt palace bring culture regret glove apology donkey explain upset tourist travel envelope bring multiply duty black divide furnace gesture they tourist',
    accountId: 15,
    pubkey: '17b7403d163df7bf56d8da481e1e68756385663d5be853c4619fb408ca322628'
  },
  {
    mnemonic: 'leisure aisle rule follow tape pet dinosaur genre interest kingdom crime label joy purpose open vicious sight assault mixture also muscle head category waste',
    accountId: 1234,
    pubkey: 'a493828b194018372f6d93d0ef369e189843c2880156ce963fb5bb79c351fea2'
  },
  {
    mnemonic: 'boss ride hybrid praise cake warfare pass insane clump mutual habit stumble clown badge energy glide phrase people eternal brisk critic scissors virus design',
    accountId: 0,
    pubkey: '9b6fbd2b837c75343c2bf66123318c9357a626238ae11f94d2dde4de38ce3547'
  },
  {
    mnemonic: 'require beauty sausage tone remain boil mutual chat sun sheriff run account sheriff code hamster canvas crop essay position achieve legal sound volume engage',
    accountId: 1,
    pubkey: '3e37e731cf82c0a71ef8579b081676970036a98975c8830a316ed6ea2f5e1c72'
  },
]

describe('KeyGeneration', function () {
  test.concurrent.each(models)('check fixed mnemonic', async function (m) {
    const sim = new Zemu(m.path)

    // Derivation path: m/44'/283'/accountId'/0/0

    for (const input of inputs) {
          const jsOutput = hdKeyDerivation(input.mnemonic, "", ALGO_PATH, (0x80000000 + input.accountId), 0, 0);

      try {
            defaultOptions.custom = `-s "${input.mnemonic}"`,
            await sim.start({ ...defaultOptions, model: m.name })
            const app = new AlgorandApp(sim.getTransport())

            const resp = await app.getAddressAndPubKey(input.accountId)
            expect(resp.return_code).toEqual(0x9000)
            expect(resp.publicKey).toEqual(jsOutput?.pk.toString('hex'))
            expect(input.pubkey).toEqual(jsOutput?.pk.toString('hex'))
          } finally {
            await sim.close()
          }
    }
  })

  test.concurrent.each(models)('check random mnemonic', async function (m) {
    const sim = new Zemu(m.path)

    for (let i = 0; i < 5; i++) {
      // Generate random 24-word mnemonic
      const mnemonic = bip39.generateMnemonic(256)
      console.log(`testing mnemonic: ${mnemonic}`)

      try {
        defaultOptions.custom = `-s "${mnemonic}"`,
        await sim.start({ ...defaultOptions, model: m.name })
        const app = new AlgorandApp(sim.getTransport())

        for (let i = 0; i < 5; i++) {
          const randomAccountId = Math.floor(Math.random() * 101);
          const jsOutput = hdKeyDerivation(mnemonic, "", ALGO_PATH, (0x80000000 + randomAccountId), 0, 0);

          const resp = await app.getAddressAndPubKey(randomAccountId)

          expect(resp.return_code).toEqual(0x9000)
          expect(resp.error_message).toEqual('No errors')

          expect(resp.publicKey).toEqual(jsOutput?.pk.toString('hex'))
        }
      } finally {
        await sim.close()
      }
    }

  })

})


describe('KeyGeneration', function () {


})
