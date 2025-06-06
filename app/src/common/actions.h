/*******************************************************************************
*   (c) 2018 - 2022 Zondax AG
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
#pragma once

#include <stdint.h>
#include "crypto.h"
#include "crypto_utils.h"
#include "tx.h"
#include "apdu_codes.h"
#include <os_io_seproxyhal.h>
#include "coin.h"
#include "zxerror.h"

extern uint16_t action_addrResponseLen;

__Z_INLINE zxerr_t app_fill_address() {
    // Put data directly in the apdu buffer
    MEMZERO(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE);

    action_addrResponseLen = 0;
    zxerr_t err = crypto_fillAddress(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE, &action_addrResponseLen);

    if (err != zxerr_ok || action_addrResponseLen == 0) {
        THROW(APDU_CODE_EXECUTION_ERROR);
    }

    return zxerr_ok;
}

__Z_INLINE void app_sign() {
    const uint8_t *message = tx_get_buffer();
    const uint16_t messageLength = tx_get_buffer_length();

    zxerr_t err = crypto_sign(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE - 3, message, messageLength);

    if (err != zxerr_ok) {
        set_code(G_io_apdu_buffer, 0, APDU_CODE_SIGN_VERIFY_ERROR);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
    } else {
        set_code(G_io_apdu_buffer, SK_LEN_25519, APDU_CODE_OK);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, SK_LEN_25519 + 2);
    }
}

// EdDSA(SHA256(data) + SHA256(authenticatedData))
__Z_INLINE void app_sign_arbitrary() {
    parser_context_t *ctx = tx_get_parser_context();
    const uint8_t *data = ctx->parser_arbitrary_data_obj->dataBuffer;
    const uint16_t dataLen = ctx->parser_arbitrary_data_obj->dataLen;
    const uint8_t *authData = ctx->parser_arbitrary_data_obj->authDataBuffer;
    const uint16_t authDataLen = ctx->parser_arbitrary_data_obj->authDataLen;

    uint8_t dataHash[SHA256_DIGEST_SIZE] = {0};
    uint8_t authDataHash[SHA256_DIGEST_SIZE] = {0};
    uint8_t message[SHA256_DIGEST_SIZE * 2] = {0};
    uint16_t messageLength = SHA256_DIGEST_SIZE * 2;

    if (crypto_sha256(data, dataLen, dataHash, SHA256_DIGEST_SIZE) != zxerr_ok) {
        set_code(G_io_apdu_buffer, 0, APDU_CODE_SIGN_VERIFY_ERROR);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
        return;
    }

    if (crypto_sha256(authData, authDataLen, authDataHash, SHA256_DIGEST_SIZE) != zxerr_ok) {
        set_code(G_io_apdu_buffer, 0, APDU_CODE_SIGN_VERIFY_ERROR);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
        return;
    }

    MEMMOVE((void*)message, (void*)dataHash, SHA256_DIGEST_SIZE);
    MEMMOVE((void*)(message + SHA256_DIGEST_SIZE), (void*)authDataHash, SHA256_DIGEST_SIZE);

    zxerr_t err = crypto_sign(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE - 3, message, messageLength);

    if (err != zxerr_ok) {
        set_code(G_io_apdu_buffer, 0, APDU_CODE_SIGN_VERIFY_ERROR);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
    } else {
        set_code(G_io_apdu_buffer, SK_LEN_25519, APDU_CODE_OK);
        io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, SK_LEN_25519 + 2);
    }
}

__Z_INLINE void app_reject() {
    MEMZERO(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE);
    set_code(G_io_apdu_buffer, 0, APDU_CODE_COMMAND_NOT_ALLOWED);
    io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
}

__Z_INLINE void app_reply_address() {
    set_code(G_io_apdu_buffer, action_addrResponseLen, APDU_CODE_OK);
    io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, action_addrResponseLen + 2);
}

__Z_INLINE void app_reply_error() {
    set_code(G_io_apdu_buffer, 0, APDU_CODE_DATA_INVALID);
    io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 2);
}
