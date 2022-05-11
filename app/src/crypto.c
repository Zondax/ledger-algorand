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

    // explicit_bzero(&cx_publicKey, sizeof(cx_publicKey));
    // explicit_bzero(&cx_privateKey, sizeof(cx_privateKey));

    if (pubKeyLen < PK_LEN_25519) {
        return zxerr_invalid_crypto_settings;
    }

ZEMU_LOGF(200, "FT HDPATH: %d | %d | %d | %d | %d\n", path[0]&0xFFF, path[1]&0xFFF, path[2]&0xFFF, path[3]&0xFFF, path[4]&0xFFF)
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
            for(unsigned int i = 0; i < 10; i++) {
                // ZEMU_LOGF(100, "PrivKey: %d | %d \n", i, cx_privateKey.d[i])
                ZEMU_LOGF(100, "PrivKey: %d | %d \n", i, privateKeyData[i])
            }

            cx_ecfp_init_public_key(CX_CURVE_Ed25519, NULL, 0, &cx_publicKey);
            cx_ecfp_generate_pair(CX_CURVE_Ed25519, &cx_publicKey, &cx_privateKey, 1);
            for (unsigned int i = 0; i < PK_LEN_25519; i++) {
                pubKey[i] = cx_publicKey.W[64 - i];
                ZEMU_LOGF(50, "PubKey: %d | %d \n", i, pubKey[i])
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

// zxerr_t crypto_sign_ed25519(uint8_t *signature, uint16_t signatureMaxlen, const uint8_t *message, uint16_t messageLen) {
//     const uint8_t *toSign = message;
//     uint8_t messageDigest[BLAKE2B_DIGEST_SIZE];

//     if (messageLen > MAX_SIGN_SIZE) {
//         // Hash it
//         cx_blake2b_t ctx;
//         cx_blake2b_init(&ctx, 256);
//         cx_hash(&ctx.header, CX_LAST, message, messageLen, messageDigest, BLAKE2B_DIGEST_SIZE);
//         toSign = messageDigest;
//         messageLen = BLAKE2B_DIGEST_SIZE;
//     }

//     cx_ecfp_private_key_t cx_privateKey;
//     uint8_t privateKeyData[SK_LEN_25519];
//     unsigned int info = 0;

//     zxerr_t err = zxerr_ok;
//     BEGIN_TRY
//     {
//         TRY
//         {
//             // Generate keys
//             os_perso_derive_node_bip32_seed_key(
//                     HDW_NORMAL,
//                     CX_CURVE_Ed25519,
//                     hdPath,
//                     HDPATH_LEN_DEFAULT,
//                     privateKeyData,
//                     NULL,
//                     NULL,
//                     0);

//             cx_ecfp_init_private_key(CX_CURVE_Ed25519, privateKeyData, SCALAR_LEN_ED25519, &cx_privateKey);

//             // Sign
//             *signature = PREFIX_SIGNATURE_TYPE_ED25519;
//             cx_eddsa_sign(&cx_privateKey,
//                           CX_LAST,
//                           CX_SHA512,
//                           toSign,
//                           messageLen,
//                           NULL,
//                           0,
//                           signature + 1,
//                           signatureMaxlen - 1,
//                           &info);

//         }
//         CATCH_ALL
//         {
//             err = zxerr_unknown;
//         }
//         FINALLY
//         {
//             MEMZERO(&cx_privateKey, sizeof(cx_privateKey));
//             MEMZERO(privateKeyData, SK_LEN_25519);
//         }
//     }
//     END_TRY;

//     return err;
// }
zxerr_t crypto_fillAddress(uint8_t *buffer, uint16_t bufferLen, uint16_t *addrResponseLen) {
    // if (bufferLen < PK_LEN_25519 + SS58_ADDRESS_MAX_LEN) {
    //     return zxerr_unknown;
    // }

    MEMZERO(buffer, bufferLen);
    CHECK_ZXERR(crypto_extractPublicKey(hdPath, buffer, bufferLen))
    ZEMU_LOGF(200, "FILL ADDRESS 01")

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
