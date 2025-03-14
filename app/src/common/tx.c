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
#include "app_mode.h"
#include "common/parser.h"
#include "parser_encoding.h"
#include <string.h>
#include "zxmacros.h"
#include "zxformat.h"

#if !defined(TARGET_NANOS)
#define RAM_BUFFER_SIZE 8192
#define FLASH_BUFFER_SIZE 16384
#else
#define RAM_BUFFER_SIZE 256
#define FLASH_BUFFER_SIZE 8192
#endif

#define OFFSET_DATA 5

// Ram
uint8_t ram_buffer[RAM_BUFFER_SIZE];

// Flash
typedef struct
{
    uint8_t buffer[FLASH_BUFFER_SIZE];
} storage_t;

arbitrary_sign_data_t arbitrary_sign_data;

#if defined(TARGET_NANOS) || defined(TARGET_NANOX) || defined(TARGET_NANOS2) || defined(TARGET_STAX) || defined(TARGET_FLEX)
storage_t NV_CONST N_appdata_impl __attribute__((aligned(64)));
#define N_appdata (*(NV_VOLATILE storage_t *)PIC(&N_appdata_impl))
#else
storage_t N_appdata_impl;
#define N_appdata N_appdata_impl
#endif

static parser_tx_t parser_tx_obj;
static parser_context_t ctx_parsed_tx;

tx_parsed_json_t tx_parsed_json;

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

uint8_t tx_is_flash_buffer_in_use()
{
    return buffering_get_flash_buffer()->in_use;
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

    if (displayIdx >= numItems) {
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

zxerr_t tx_getItem_arbitrary(int8_t displayIdx, char *outKey, uint16_t outKeyLen, char *outVal, uint16_t outValLen, uint8_t pageIdx, uint8_t *pageCount) {
    uint8_t numItems = 0;

    CHECK_ZXERR(tx_getNumItems_arbitrary(&numItems))

    if (displayIdx >= numItems) {
        return zxerr_no_data;
    }

    MEMZERO(outKey, outKeyLen);
    MEMZERO(outVal, outValLen);
    *pageCount = 0;


    if (displayIdx < 0) {
        snprintf(outKey, outKeyLen, "Review message");
        return zxerr_ok;
    }

    if (displayIdx == 0) {
        *pageCount = 1;
        snprintf(outKey, outKeyLen, "Domain");
        pageString(outVal, outValLen, (char *)arbitrary_sign_data.domain, pageIdx, pageCount);
        return zxerr_ok;
    }

    if (displayIdx == 1) {
        *pageCount = 1;
        snprintf(outKey, outKeyLen, "Signer");

        char hex_str_pk[PK_LEN_25519 * 2] = {0};
        memcpy(hex_str_pk, arbitrary_sign_data.signer, PK_LEN_25519 * 2);

        uint8_t pk[PK_LEN_25519] = {0};
        hexstr_to_array(pk, sizeof(pk), hex_str_pk, sizeof(hex_str_pk));

        char addr[80] = {0};

        if (encodePubKey((uint8_t*) addr, sizeof(addr), pk) == 0) {
            return zxerr_encoding_failed;
        }

        pageString(outVal, outValLen, addr, pageIdx, pageCount);
        return zxerr_ok;
    }

    if (arbitrary_sign_data.requestId) {
        if (displayIdx == 2) {
            *pageCount = 1;
            snprintf(outKey, outKeyLen, "Request ID");
            pageString(outVal, outValLen, (char *)arbitrary_sign_data.requestId, pageIdx, pageCount);
            return zxerr_ok;
        }
    } else {
        displayIdx++;
    }

    if (arbitrary_sign_data.hdPath) {
        if (displayIdx == 3) {
            *pageCount = 1;
            snprintf(outKey, outKeyLen, "HD Path");
            pageString(outVal, outValLen, (char *)arbitrary_sign_data.hdPath, pageIdx, pageCount);
            return zxerr_ok;
        }
    } else {
        displayIdx++;
    }

    if (displayIdx == 4) {
        *pageCount = 1;
        snprintf(outKey, outKeyLen, "Auth Data");
        pageStringHex(outVal, outValLen, (char *)arbitrary_sign_data.authData, arbitrary_sign_data.authDataLen, pageIdx, pageCount);
        return zxerr_ok;
    }

    size_t key_len = 0;
    uint8_t idx = displayIdx - 5;
    char *key_pos = tx_parsed_json.json_key_positions[idx];

    while (key_pos[key_len++] != '"')
        ;

    if (key_len > outKeyLen) {
        key_len = outKeyLen;
    }

    snprintf(outKey, key_len, "%s", tx_parsed_json.json_key_positions[idx]);
    outKey[key_len - 1] = '\0';

    char tmpBuf[256];
    snprintf(tmpBuf, sizeof(tmpBuf), "%s", tx_parsed_json.json_value_positions[idx]);
    tmpBuf[tx_parsed_json.json_value_lengths[idx]] = '\0';
    pageString(outVal, outValLen, tmpBuf, pageIdx, pageCount);

    return zxerr_ok;
}

zxerr_t tx_getNumItems_arbitrary(uint8_t *num_items) {
    parser_error_t err = parser_getNumItems_arbitrary(num_items);
    if (err != parser_ok) {
        return zxerr_unknown;
    }
    return zxerr_ok;
}

const char *tx_parse_arbitrary() {
    MEMZERO(&arbitrary_sign_data, sizeof(arbitrary_sign_data_t));
    MEMZERO(&tx_parsed_json, sizeof(tx_parsed_json_t));

    const uint8_t* buf = tx_get_buffer();

    parser_error_t err = parser_parse_arbitrary(buf, &arbitrary_sign_data, &tx_parsed_json);

    CHECK_APP_CANARY()

    if (err != parser_ok)
    {
        return parser_getErrorDescription(err);
    }

    return NULL;
}
