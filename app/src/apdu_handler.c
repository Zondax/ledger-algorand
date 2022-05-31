/*******************************************************************************
*   (c) 2018, 2022 Zondax GmbH
*   (c) 2016 Ledger
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

#include "app_main.h"

#include <string.h>
#include <os_io_seproxyhal.h>
#include <os.h>
#include <ux.h>

#include "view.h"
#include "actions.h"
#include "tx.h"
#include "addr.h"
#include "crypto.h"
#include "coin.h"
#include "zxmacros.h"

#include "algo_tx.h"
#include "algo_keys.h"

#include "crypto.h"
#include "algo_addr.h"

static bool tx_initialized = false;

#if defined(TARGET_NANOX) || defined(TARGET_NANOS2)
#define TNX_BUFFER_SIZE 2048
#else
#define TNX_BUFFER_SIZE 900
#endif

uint8_t msgpack_buf[TNX_BUFFER_SIZE];
unsigned int msgpack_next_off;

struct pubkey_s public_key;
txn_t current_txn;

__Z_INLINE uint8_t convertP1P2(const uint8_t p1, const uint8_t p2)
{
    if (p1 <= P1_FIRST_ACCOUNT_ID && p2 == P2_MORE) {
        return P1_INIT;
    } else if (p1 == P1_MORE && p2 == P2_MORE) {
        return P1_ADD;
    } else if (p1 == P1_MORE && p2 == P2_LAST) {
        return P1_LAST;
    } else if (p1 <= P1_FIRST_ACCOUNT_ID && p2 == P2_LAST) {
        // Transaction fits in one chunk
        return P1_SINGLE_CHUNK;
    }
    return 0xFF;
}

__Z_INLINE bool process_chunk(__Z_UNUSED volatile uint32_t *tx, uint32_t rx)
{
    const uint8_t P1 = G_io_apdu_buffer[OFFSET_P1];
    const uint8_t P2 = G_io_apdu_buffer[OFFSET_P2];
    const uint8_t payloadType = convertP1P2(P1, P2);

    if (rx < OFFSET_DATA) {
        THROW(APDU_CODE_WRONG_LENGTH);
    }

    uint32_t added;
    uint8_t accountIdSize = 0;
    switch (payloadType) {
        case P1_INIT:
            tx_initialize();
            tx_reset();
            tx_initialized = true;
            if (P1 == P1_FIRST_ACCOUNT_ID) {
                extractHDPath();
                accountIdSize = ACCOUNT_ID_LENGTH;
            }
            added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA + accountIdSize]), rx - OFFSET_DATA);
            if (added != rx - OFFSET_DATA) {
                tx_initialized = false;
                THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
            }
            return false;

        case P1_ADD:
            if (!tx_initialized) {
                THROW(APDU_CODE_TX_NOT_INITIALIZED);
            }
            added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA]), rx - OFFSET_DATA);
            if (added != rx - OFFSET_DATA) {
                tx_initialized = false;
                THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
            }
            return false;

        case P1_LAST:
            if (!tx_initialized) {
                THROW(APDU_CODE_TX_NOT_INITIALIZED);
            }
            added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA]), rx - OFFSET_DATA);
            tx_initialized = false;
            if (added != rx - OFFSET_DATA) {
                tx_initialized = false;
                THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
            }
            tx_initialized = false;
            return true;

        case P1_SINGLE_CHUNK:
            tx_initialize();
            tx_reset();
            if (P1 == P1_FIRST_ACCOUNT_ID) {
                extractHDPath();
                accountIdSize = ACCOUNT_ID_LENGTH;
            }
            added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA + accountIdSize]), rx - OFFSET_DATA);
            tx_initialized = false;
            if (added != rx - OFFSET_DATA) {
                THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
            }
            return true;
    }

    THROW(APDU_CODE_INVALIDP1P2);
}

// From main.c ---> moved here
static void copy_and_advance(void *dst, uint8_t **p, size_t len)
{
    MEMMOVE(dst, *p, len);
    *p += len;
}

void handle_sign_payment(uint8_t ins)
{
    uint8_t *p;

    MEMZERO(&current_txn, sizeof(current_txn));

    if (ins == INS_SIGN_PAYMENT_V2) {
        p = &G_io_apdu_buffer[2];
    } else {
        p = &G_io_apdu_buffer[OFFSET_DATA];
    }

    _Static_assert(sizeof(G_io_apdu_buffer) - OFFSET_DATA >= 192, "assert");

    current_txn.type = TX_PAYMENT;
    copy_and_advance( current_txn.sender,           &p, 32);
    copy_and_advance(&current_txn.fee,              &p, 8);
    copy_and_advance(&current_txn.firstValid,       &p, 8);
    copy_and_advance(&current_txn.lastValid,        &p, 8);
    copy_and_advance( current_txn.genesisID,        &p, 32);
    copy_and_advance( current_txn.genesisHash,      &p, 32);
    copy_and_advance( current_txn.payment.receiver, &p, 32);
    copy_and_advance(&current_txn.payment.amount,   &p, 8);
    copy_and_advance( current_txn.payment.close,    &p, 32);

    // ui_txn();
    // view_review_init(tx_getItem, tx_getNumItems, txn_approve);
    // view_review_show();
    // *flags |= IO_ASYNCH_REPLY;
}

static void handle_sign_keyreg(uint8_t ins)
{
    uint8_t *p;

    MEMZERO(&current_txn, sizeof(current_txn));

    if (ins == INS_SIGN_KEYREG_V2) {
        p = &G_io_apdu_buffer[2];
    } else {
        p = &G_io_apdu_buffer[OFFSET_DATA];
    }

    _Static_assert(sizeof(G_io_apdu_buffer) - OFFSET_DATA >= 184, "assert");

    current_txn.type = TX_KEYREG;
    copy_and_advance( current_txn.sender,        &p, 32);
    copy_and_advance(&current_txn.fee,           &p, 8);
    copy_and_advance(&current_txn.firstValid,    &p, 8);
    copy_and_advance(&current_txn.lastValid,     &p, 8);
    copy_and_advance( current_txn.genesisID,     &p, 32);
    copy_and_advance( current_txn.genesisHash,   &p, 32);
    copy_and_advance( current_txn.keyreg.votepk, &p, 32);
    copy_and_advance( current_txn.keyreg.vrfpk,  &p, 32);
    copy_and_advance( current_txn.keyreg.sprfkey,  &p, 64);

    // ui_txn();
}

static void txn_approve(void)
{
    int sign_size = 0;
    unsigned int msg_len = 0;

    msgpack_buf[0] = 'T';
    msgpack_buf[1] = 'X';

    //   msg_len = 2 + tx_encode(&current_txn, msgpack_buf+2, sizeof(msgpack_buf)-2);

    PRINTF("Signing message: %.*h\n", msg_len, msgpack_buf);
    PRINTF("Signing message: accountId:%d\n", current_txn.accountId);

    //   zxerr_t err = crypto_sign_ed25519(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE - 3, message, messageLength);
    // crypto_sign(G_io_apdu_buffer, IO_APDU_BUFFER_SIZE - 3, tx_get_buffer(), tx_get_buffer_length());

    int error = algorand_sign_message(current_txn.accountId, &msgpack_buf[0], msg_len, G_io_apdu_buffer, &sign_size);
    if (error) {
    THROW(error);
    }

    //   G_io_apdu_buffer[sign_size++] = 0x90;
    //   G_io_apdu_buffer[sign_size++] = 0x00;

    // we've just signed the txn so we clear the static struct
    //   explicit_bzero(&current_txn, sizeof(current_txn));
    //   msgpack_next_off = 0;
    tx_reset();

    // Send back the response, do not restart the event loop
    //   io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, sign_size);

    // Display back the original UX
    //   ui_idle();
}

__Z_INLINE void handle_sign_msgpack(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx)
{
    if (!process_chunk(tx, rx)) {
        THROW(APDU_CODE_OK);
    }

    // error = parse_input_for_msgpack_command(G_io_apdu_buffer, rx, msgpack_buf, TNX_BUFFER_SIZE, &msgpack_next_off, &current_txn, &error_msg);
    //We need to add TX to input buffer before signing
    const char *error_msg = tx_parse();
    CHECK_APP_CANARY()

    if (error_msg != NULL) {
        int error_msg_length = strlen(error_msg);
        memcpy(G_io_apdu_buffer, error_msg, error_msg_length);
        *tx += (error_msg_length);
        THROW(APDU_CODE_DATA_INVALID);
    }

    view_review_init(tx_getItem, tx_getNumItems, app_sign);
    view_review_show(0x03);
    *flags |= IO_ASYNCH_REPLY;
}

__Z_INLINE void handle_get_public_key(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx)
{
    const uint8_t requireConfirmation = G_io_apdu_buffer[OFFSET_P1];
    extractHDPath();

    zxerr_t err = app_fill_address();
    if (err != zxerr_ok) {
        THROW(APDU_CODE_UNKNOWN);
    }

    if (requireConfirmation) {
        view_review_init(addr_getItem, addr_getNumItems, app_reply_address);
        view_review_show(0x03);
        *flags |= IO_ASYNCH_REPLY;
        return;
    }

    *tx = action_addrResponseLen;
    THROW(APDU_CODE_OK);
}

__Z_INLINE void handle_getversion(volatile uint32_t *flags, volatile uint32_t *tx)
{
    G_io_apdu_buffer[0] = 0;

#if defined(APP_TESTING)
    G_io_apdu_buffer[0] = 0x01;
#endif

    G_io_apdu_buffer[1] = (LEDGER_MAJOR_VERSION >> 8) & 0xFF;
    G_io_apdu_buffer[2] = (LEDGER_MAJOR_VERSION >> 0) & 0xFF;

    G_io_apdu_buffer[3] = (LEDGER_MINOR_VERSION >> 8) & 0xFF;
    G_io_apdu_buffer[4] = (LEDGER_MINOR_VERSION >> 0) & 0xFF;

    G_io_apdu_buffer[5] = (LEDGER_PATCH_VERSION >> 8) & 0xFF;
    G_io_apdu_buffer[6] = (LEDGER_PATCH_VERSION >> 0) & 0xFF;

    G_io_apdu_buffer[7] = !IS_UX_ALLOWED;

    G_io_apdu_buffer[8] = (TARGET_ID >> 24) & 0xFF;
    G_io_apdu_buffer[9] = (TARGET_ID >> 16) & 0xFF;
    G_io_apdu_buffer[10] = (TARGET_ID >> 8) & 0xFF;
    G_io_apdu_buffer[11] = (TARGET_ID >> 0) & 0xFF;

    *tx += 12;
    THROW(APDU_CODE_OK);
}

void handleApdu(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx) {
    uint16_t sw = 0;

    BEGIN_TRY
    {
        TRY
        {
            if (G_io_apdu_buffer[OFFSET_CLA] != CLA) {
                THROW(APDU_CODE_CLA_NOT_SUPPORTED);
            }

            if (rx < APDU_MIN_LENGTH) {
                THROW(APDU_CODE_WRONG_LENGTH);
            }

            const uint8_t ins = G_io_apdu_buffer[OFFSET_INS];
            switch (ins) {
                case INS_SIGN_PAYMENT_V2:
                case INS_SIGN_PAYMENT_V3:
                    handle_sign_payment(ins);
                    *flags |= IO_ASYNCH_REPLY;
                    break;

                case INS_SIGN_KEYREG_V2:
                case INS_SIGN_KEYREG_V3:
                    if( os_global_pin_is_validated() != BOLOS_UX_OK ) {
                        THROW(APDU_CODE_COMMAND_NOT_ALLOWED);
                    }
                    handle_sign_keyreg(ins);
                    *flags |= IO_ASYNCH_REPLY;
                    break;

                case INS_SIGN_MSGPACK:
                    if (os_global_pin_is_validated() != BOLOS_UX_OK) {
                        THROW(APDU_CODE_COMMAND_NOT_ALLOWED);
                    }
                    handle_sign_msgpack(flags, tx, rx);
                    break;

                case INS_GET_PUBLIC_KEY: {
                    if( os_global_pin_is_validated() != BOLOS_UX_OK ) {
                        THROW(APDU_CODE_COMMAND_NOT_ALLOWED);
                    }
                    handle_get_public_key(flags, tx, rx);
                    break;
                }

                case INS_GET_VERSION: {
                    handle_getversion(flags, tx);
                    THROW(APDU_CODE_OK);
                    break;
                }

                default:
                    THROW(APDU_CODE_INS_NOT_SUPPORTED);
            }
        }
        CATCH(EXCEPTION_IO_RESET)
        {
            THROW(EXCEPTION_IO_RESET);
        }
        CATCH_OTHER(e)
        {
            switch (e & 0xF000) {
                case 0x6000:
                case APDU_CODE_OK:
                    sw = e;
                    break;
                default:
                    sw = 0x6800 | (e & 0x7FF);
                    break;
            }
            G_io_apdu_buffer[*tx] = sw >> 8;
            G_io_apdu_buffer[*tx + 1] = sw;
            *tx += 2;
        }
        FINALLY
        {
        }
    }
    END_TRY;
}
