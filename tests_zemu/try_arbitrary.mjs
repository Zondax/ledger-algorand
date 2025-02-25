import TransportNodeHid from '@ledgerhq/hw-transport-node-hid'
import pkg from '@zondax/ledger-algorand'
const { AlgorandApp, ScopeType } = pkg
import { canonify } from '@truestamp/canonify';
import * as crypto from 'crypto'
// @ts-ignore
import ed25519 from 'ed25519-supercop'

async function main() {
  const transport = await TransportNodeHid.default.open()
  try {
    const app = new (AlgorandApp.default || AlgorandApp)(transport)

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const authData = new Uint8Array(crypto.createHash('sha256').update("arc60.io").digest())

      const authRequest = {
        data: Buffer.from('eyJjaGFsbGVuZ2UiOiJlU1pWc1ltdk5DakpHSDVhOVdXSWpLcDVqbTVERnhsd0JCQXc5emM4RlpNPSIsIm9yaWdpbiI6Imh0dHBzOi8vYXJjNjAuaW8iLCJ0eXBlIjoiYXJjNjAuY3JlYXRlIn0').toString(),
        signer: pubKey,
        domain: "arc60.io",
        requestId: Buffer.from(Array(32).fill(2)).toString('base64'),
        authenticationData: authData,
        hdPath: "m/44'/60'/0'/0/0"
      }

      // do not wait here.. we need to navigate
      const signatureRequest = app.signData(authRequest, { scope: ScopeType.AUTH, encoding: 'base64' })

      const signatureResponse = await signatureRequest

      console.log('signatureResponse', signatureResponse)

  } catch (e) {
    console.error(e)
  }
}
;(async () => {
  await main()
})()