/*******************************************************************************
*   (c) 2018, 2019 Zondax GmbH
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
// #include "actions.h"
// #include "tx.h"
// #include "addr.h"
// #include "crypto.h"
#include "coin.h"
#include "zxmacros.h"

#include "apdu_protocol_defines.h"
static bool tx_initialized = false;


// From main.c ---> move here
void handle_sign_payment(uint8_t ins)
{

}

static void handle_sign_keyreg(uint8_t ins)
{

}

static int handle_sign_msgpack(volatile unsigned int rx, volatile unsigned int *tx)
{
 return 0;
}
static int handle_get_public_key(volatile unsigned int rx, volatile unsigned int *tx)
{
    return 0;
}

// void extractHDPath(uint32_t rx, uint32_t offset) {
//     tx_initialized = false;

//     if ((rx - offset) < sizeof(uint32_t) * HDPATH_LEN_DEFAULT) {
//         THROW(APDU_CODE_WRONG_LENGTH);
//     }

//     MEMCPY(hdPath, G_io_apdu_buffer + offset, sizeof(uint32_t) * HDPATH_LEN_DEFAULT);

//     const bool mainnet = hdPath[0] == HDPATH_0_DEFAULT &&
//                          hdPath[1] == HDPATH_1_DEFAULT;

//     const bool testnet = hdPath[0] == HDPATH_0_TESTNET &&
//                          hdPath[1] == HDPATH_1_TESTNET;

//     if (!mainnet && !testnet) {
//         THROW(APDU_CODE_DATA_INVALID);
//     }
// }

// bool process_chunk(__Z_UNUSED volatile uint32_t *tx, uint32_t rx) {

//     const uint8_t payloadType = G_io_apdu_buffer[OFFSET_PAYLOAD_TYPE];

//     if (G_io_apdu_buffer[OFFSET_P2] != 0) {
//         THROW(APDU_CODE_INVALIDP1P2);
//     }

//     if (rx < OFFSET_DATA) {
//         THROW(APDU_CODE_WRONG_LENGTH);
//     }

//     uint32_t added;
//     switch (payloadType) {
//         case P1_INIT:
//             tx_initialize();
//             tx_reset();
//             extractHDPath(rx, OFFSET_DATA);
//             tx_initialized = true;
//             return false;
//         case P1_ADD:
//             if (!tx_initialized) {
//                 THROW(APDU_CODE_TX_NOT_INITIALIZED);
//             }
//             added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA]), rx - OFFSET_DATA);
//             if (added != rx - OFFSET_DATA) {
//                 tx_initialized = false;
//                 THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
//             }
//             return false;
//         case P1_LAST:
//             if (!tx_initialized) {
//                 THROW(APDU_CODE_TX_NOT_INITIALIZED);
//             }
//             added = tx_append(&(G_io_apdu_buffer[OFFSET_DATA]), rx - OFFSET_DATA);
//             tx_initialized = false;
//             if (added != rx - OFFSET_DATA) {
//                 THROW(APDU_CODE_OUTPUT_BUFFER_TOO_SMALL);
//             }
//             return true;
//     }

//     THROW(APDU_CODE_INVALIDP1P2);
// }

// __Z_INLINE void handleGetAddr(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx) {
//     extractHDPath(rx, OFFSET_DATA);

//     uint8_t requireConfirmation = G_io_apdu_buffer[OFFSET_P1];

//     zxerr_t zxerr = app_fill_address();
//     if (zxerr != zxerr_ok) {
//         *tx = 0;
//         THROW(APDU_CODE_DATA_INVALID);
//     }
//     if (requireConfirmation) {
//         view_review_init(addr_getItem, addr_getNumItems, app_reply_address);
//         view_review_show();
//         *flags |= IO_ASYNCH_REPLY;
//         return;
//     }
//     *tx = action_addrResponseLen;
//     THROW(APDU_CODE_OK);
// }

// __Z_INLINE void handleSign(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx) {
//     if (!process_chunk(tx, rx)) {
//         THROW(APDU_CODE_OK);
//     }

//     CHECK_APP_CANARY()

//     const char *error_msg = tx_parse();
//     CHECK_APP_CANARY()

//     if (error_msg != NULL) {
//         int error_msg_length = strlen(error_msg);
//         MEMCPY(G_io_apdu_buffer, error_msg, error_msg_length);
//         *tx += (error_msg_length);
//         THROW(APDU_CODE_DATA_INVALID);
//     }

//     CHECK_APP_CANARY()
//     view_review_init(tx_getItem, tx_getNumItems, app_sign);
//     view_review_show();
//     *flags |= IO_ASYNCH_REPLY;
// }

void handleApdu(volatile uint32_t *flags, volatile uint32_t *tx, uint32_t rx) {
    uint16_t sw = 0;
    int error;

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
            // switch (G_io_apdu_buffer[OFFSET_INS]) {
            switch (ins) {
                case INS_SIGN_PAYMENT_V2:
                case INS_SIGN_PAYMENT_V3:
                    handle_sign_payment(ins);
                    *flags |= IO_ASYNCH_REPLY;
                    break;

                case INS_SIGN_KEYREG_V2:
                case INS_SIGN_KEYREG_V3:
                    handle_sign_keyreg(ins);
                    *flags |= IO_ASYNCH_REPLY;
                    break;

                case INS_SIGN_MSGPACK:
                    error = handle_sign_msgpack(rx, tx);
                    if (error) {
                        THROW(error);
                    }
                    if (tx != 0) {
                        THROW(APDU_CODE_OK);
                    } else {
                        *flags |= IO_ASYNCH_REPLY;
                    }
                    break;

                case INS_GET_PUBLIC_KEY:
                    error = handle_get_public_key(rx, tx);
                    if (error) {
                        THROW(error);
                    }
                    if (tx != 0) {
                        THROW(APDU_CODE_OK);
                    } else {
                        *flags |= IO_ASYNCH_REPLY;
                    }
                    break;

//                 case INS_GET_VERSION: {
// #ifdef TESTING_ENABLED
//                     G_io_apdu_buffer[0] = 0xFF;
// #else
//                     G_io_apdu_buffer[0] = 0;
// #endif
//                     G_io_apdu_buffer[1] = LEDGER_MAJOR_VERSION;
//                     G_io_apdu_buffer[2] = LEDGER_MINOR_VERSION;
//                     G_io_apdu_buffer[3] = LEDGER_PATCH_VERSION;
//                     G_io_apdu_buffer[4] = !IS_UX_ALLOWED;

//                     G_io_apdu_buffer[5] = (TARGET_ID >> 24) & 0xFF;
//                     G_io_apdu_buffer[6] = (TARGET_ID >> 16) & 0xFF;
//                     G_io_apdu_buffer[7] = (TARGET_ID >> 8) & 0xFF;
//                     G_io_apdu_buffer[8] = (TARGET_ID >> 0) & 0xFF;

//                     *tx += 9;
//                     THROW(APDU_CODE_OK);
//                     break;
//                 }

//                 case INS_GET_ADDR_SECP256K1: {
//                     if (os_global_pin_is_validated() != BOLOS_UX_OK) {
//                         THROW(APDU_CODE_COMMAND_NOT_ALLOWED);
//                     }
//                     handleGetAddr(flags, tx, rx);
//                     break;
//                 }

//                 case INS_SIGN_SECP256K1: {
//                     if (os_global_pin_is_validated() != BOLOS_UX_OK) {
//                         THROW(APDU_CODE_COMMAND_NOT_ALLOWED);
//                     }
//                     handleSign(flags, tx, rx);
//                     break;
//                 }

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
