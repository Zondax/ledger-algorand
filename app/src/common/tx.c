/*******************************************************************************
*  (c) 2018 - 2024 Zondax AG
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

#include "tx.h"
#include "apdu_codes.h"
#include "buffering.h"
#include "common/parser.h"
#include <string.h>
#include "zxmacros.h"
#include "lib_cxng/src/cx_sha256.h"

#if defined(TARGET_NANOX) || defined(TARGET_NANOS2) || defined(TARGET_STAX) || defined(TARGET_FLEX)
#define RAM_BUFFER_SIZE 8192
#define FLASH_BUFFER_SIZE 16384
#elif defined(TARGET_NANOS)
#define RAM_BUFFER_SIZE 256
#define FLASH_BUFFER_SIZE 8192
#endif

// Ram
uint8_t ram_buffer[RAM_BUFFER_SIZE];

// Flash
typedef struct
{
    uint8_t buffer[FLASH_BUFFER_SIZE];
} storage_t;

#if defined(TARGET_NANOS) || defined(TARGET_NANOX) || defined(TARGET_NANOS2) || defined(TARGET_STAX) || defined(TARGET_FLEX)
storage_t NV_CONST N_appdata_impl __attribute__((aligned(64)));
#define N_appdata (*(NV_VOLATILE storage_t *)PIC(&N_appdata_impl))
#endif

static parser_tx_t parser_tx_obj;
static parser_context_t ctx_parsed_tx;
static group_txn_state_t group_txn;

static cx_sha256_t sha256_ctx;

parser_error_t compute_incremental_sha256(const uint8_t *buffer, uint32_t length, uint8_t *out_hash) {
    static bool sha256_initialized = false;
    if (!sha256_initialized) {
        cx_sha256_init_no_throw(&sha256_ctx);
        sha256_initialized = true;
    }
    
    if (length > 0) {
        if (cx_sha256_update(&sha256_ctx, buffer, length) != CX_OK) {
            return parser_update_hash_failed;
        }
    }
    
    if (out_hash != NULL) {
        cx_sha256_final(&sha256_ctx, out_hash);
        sha256_initialized = false;
    }
    return parser_ok;
}

void tx_group_state_reset() {
    group_txn.num_of_validated_txns = 0;
    group_txn.num_of_txns = 0;
    group_txn.initialized = 0;
}

uint8_t tx_group_get_num_of_txns() {
    return group_txn.num_of_txns;
}

uint8_t tx_group_get_num_of_validated_txns() {
    return group_txn.num_of_validated_txns;
}

void tx_group_increment_num_of_validated_txns() {
    group_txn.num_of_validated_txns++;
}

uint8_t tx_group_is_initialized() {
    return group_txn.initialized;
}

void tx_group_initialize() {
    group_txn.initialized = 1;
}

void tx_group_set_num_of_txns(uint8_t num_of_txns) {
    group_txn.num_of_txns = num_of_txns;
}

void tx_initialize()
{
    buffering_init(
        ram_buffer,
        sizeof(ram_buffer),
        (uint8_t *)N_appdata.buffer,
        sizeof(N_appdata.buffer));
}

void tx_reset()
{
    buffering_reset();
}

uint32_t tx_append(unsigned char *buffer, uint32_t length)
{
    return buffering_append(buffer, length);
}

uint32_t tx_get_buffer_length()
{
    return buffering_get_buffer()->pos;
}

uint8_t *tx_get_buffer()
{
    return buffering_get_buffer()->data;
}

const char *tx_parse()
{
    MEMZERO(&parser_tx_obj, sizeof(parser_tx_obj));

    uint8_t err = parser_parse(&ctx_parsed_tx,
                               tx_get_buffer()+2,   // 'TX' is prepended to input buffer
                               tx_get_buffer_length(),
                               &parser_tx_obj);
    CHECK_APP_CANARY()

    if (err != parser_ok)
    {
        return parser_getErrorDescription(err);
    }

    if (tx_group_is_initialized()) {
        if (tx_group_get_num_of_validated_txns() < tx_group_get_num_of_txns() - 1) {
            err = compute_incremental_sha256(tx_get_buffer(), tx_get_buffer_length(), NULL);
            if(parser_ok != err) {
                return parser_getErrorDescription(err);
            }
        } else {
            compute_incremental_sha256(tx_get_buffer(), tx_get_buffer_length(), parser_tx_obj.group_txn_values.sha256);
        }
        parser_tx_obj.group_txn_values.max_fees += parser_tx_obj.fee;
    }

    err = parser_validate(&ctx_parsed_tx);
    CHECK_APP_CANARY()

    if (err != parser_ok)
    {
        return parser_getErrorDescription(err);
    }

    return NULL;
}

void tx_parse_reset()
{
    MEMZERO(&parser_tx_obj, sizeof(parser_tx_obj));
}

zxerr_t tx_getNumItems(uint8_t *num_items)
{
    if (tx_group_is_initialized()) {
        // Group ID, Group Txn sha256, Max Fees
        *num_items = 3;
        return zxerr_ok;
    }

    parser_error_t err = parser_getNumItems(num_items);
    if (err != parser_ok) {
        return zxerr_unknown;
    }
    return zxerr_ok;
}

zxerr_t tx_getItem(int8_t displayIdx,
                   char *outKey, uint16_t outKeyLen,
                   char *outVal, uint16_t outValLen,
                   uint8_t pageIdx, uint8_t *pageCount)
{
    uint8_t numItems = 0;

    CHECK_ZXERR(tx_getNumItems(&numItems))

    if (displayIdx > numItems) {
        return zxerr_no_data;
    }

    parser_error_t err = parser_getItem(&ctx_parsed_tx,
                                        displayIdx,
                                        outKey, outKeyLen,
                                        outVal, outValLen,
                                        pageIdx, pageCount);

    // Convert error codes
    if (err == parser_no_data ||
        err == parser_display_idx_out_of_range ||
        err == parser_display_page_out_of_range)
        return zxerr_no_data;

    if (err != parser_ok)
        return zxerr_unknown;

    return zxerr_ok;
}
