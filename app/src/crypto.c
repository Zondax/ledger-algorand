/*******************************************************************************
*   (c) 2018 - 2022 Zondax GmbH
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
********************************************************************************/

#include "crypto.h"
#include "base58.h"
#include "coin.h"
#include "cx.h"
#include "zxmacros.h"
// #include "ristretto.h"

uint32_t hdPath[HDPATH_LEN_DEFAULT];

zxerr_t crypto_extractPublicKey(const uint32_t path[HDPATH_LEN_DEFAULT],
                                uint8_t *pubKey, uint16_t pubKeyLen) {
    cx_ecfp_public_key_t cx_publicKey;
    cx_ecfp_private_key_t cx_privateKey;
    uint8_t privateKeyData[SK_LEN_25519];

    if (pubKeyLen < PK_LEN_25519) {
        return zxerr_invalid_crypto_settings;
    }

    zxerr_t err = zxerr_ok;
    BEGIN_TRY
    {
        TRY
        {
            // Generate keys
            os_perso_derive_node_bip32(
                    CX_CURVE_Ed25519,
                    path,
                    HDPATH_LEN_DEFAULT,
                    privateKeyData,
                    NULL);

            cx_ecfp_init_private_key(CX_CURVE_Ed25519, privateKeyData, 32, &cx_privateKey);
            cx_ecfp_init_public_key(CX_CURVE_Ed25519, NULL, 0, &cx_publicKey);
            cx_ecfp_generate_pair(CX_CURVE_Ed25519, &cx_publicKey, &cx_privateKey, 1);
            for (unsigned int i = 0; i < PK_LEN_25519; i++) {
                pubKey[i] = cx_publicKey.W[64 - i];
            }
            if ((cx_publicKey.W[PK_LEN_25519] & 1) != 0) {
                pubKey[31] |= 0x80;
            }
        }
        CATCH_ALL
        {
            err = zxerr_unknown;
        }
        FINALLY
        {
            MEMZERO(&cx_privateKey, sizeof(cx_privateKey));
            MEMZERO(privateKeyData, SK_LEN_25519);
        }
    }
    END_TRY;
    return err;
}

zxerr_t crypto_sign(uint8_t *signature, uint16_t signatureMaxlen, const uint8_t *message, uint16_t messageLen) {
    cx_ecfp_private_key_t cx_privateKey;
    uint8_t privateKeyData[SK_LEN_25519];

    zxerr_t err = zxerr_ok;
    BEGIN_TRY
    {
        TRY
        {
            // Generate keys
            os_perso_derive_node_bip32(
                    CX_CURVE_Ed25519,
                    hdPath,
                    HDPATH_LEN_DEFAULT,
                    privateKeyData,
                    NULL);

            cx_ecfp_init_private_key(CX_CURVE_Ed25519, privateKeyData, SCALAR_LEN_ED25519, &cx_privateKey);

            // Sign
            *signature = PREFIX_SIGNATURE_TYPE_ED25519;
            cx_eddsa_sign(&cx_privateKey,
                          CX_LAST,
                          CX_SHA512,
                          message,
                          messageLen,
                          NULL,
                          0,
                          signature,
                          signatureMaxlen,
                          NULL);

        }
        CATCH_ALL
        {
            err = zxerr_unknown;
        }
        FINALLY
        {
            MEMZERO(&cx_privateKey, sizeof(cx_privateKey));
            MEMZERO(privateKeyData, SK_LEN_25519);
        }
    }
    END_TRY;

    return err;
}




zxerr_t crypto_fillAddress(uint8_t *buffer, uint16_t bufferLen, uint16_t *addrResponseLen) {
    // if (bufferLen < PK_LEN_25519 + SS58_ADDRESS_MAX_LEN) {
    //     return zxerr_unknown;
    // }

    MEMZERO(buffer, bufferLen);
    CHECK_ZXERR(crypto_extractPublicKey(hdPath, buffer, bufferLen))

    // size_t outLen = crypto_SS58EncodePubkey(buffer + PK_LEN_25519,
    //                                         bufferLen - PK_LEN_25519,
    //                                         PK_ADDRESS_TYPE, buffer);
    size_t outLen = 20;

    if (outLen == 0) {
        MEMZERO(buffer, bufferLen);
        return zxerr_unknown;
    }

    *addrResponseLen = PK_LEN_25519 + outLen;
    return zxerr_ok;
}
