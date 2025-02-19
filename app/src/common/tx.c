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

char arbitrary_sign_domain[50];

void set_arbitrary_sign_domain(const char *domain) {
    strncpy(arbitrary_sign_domain, domain, sizeof(arbitrary_sign_domain));
}

#if defined(TARGET_NANOS) || defined(TARGET_NANOX) || defined(TARGET_NANOS2) || defined(TARGET_STAX) || defined(TARGET_FLEX)
storage_t NV_CONST N_appdata_impl __attribute__((aligned(64)));
#define N_appdata (*(NV_VOLATILE storage_t *)PIC(&N_appdata_impl))
#else
storage_t N_appdata_impl;
#define N_appdata N_appdata_impl
#endif

static parser_tx_t parser_tx_obj;
static parser_context_t ctx_parsed_tx;
typedef struct {
    char *json_key_positions[15];
    char *json_value_positions[15];
    uint16_t json_value_lengths[15];
} tx_parsed_json_t;

tx_parsed_json_t tx_parsed_json;

static group_txn_state_t group_txn;

void tx_group_state_reset() {
    group_txn.num_of_txns = 0;
    group_txn.initialized = 0;
    group_txn.num_of_txns_reviewed = 0;
}

uint8_t tx_group_get_num_of_txns() {
    return group_txn.num_of_txns;
}

uint8_t tx_group_get_num_of_txns_reviewed() {
    return group_txn.num_of_txns_reviewed;
}

void tx_group_increment_num_of_txns_reviewed() {
    group_txn.num_of_txns_reviewed++;
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

    if (tx_group_is_initialized() && app_mode_blindsign_required()) {
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
    if (tx_group_is_initialized() && app_mode_blindsign_required()) {
        // Group ID, Max Fees, Sender
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
        pageString(outVal, outValLen, arbitrary_sign_domain, pageIdx, pageCount);
        return zxerr_ok;
    }

    size_t key_len = 0;
    char *key_pos = tx_parsed_json.json_key_positions[displayIdx - 1];

    while (key_pos[key_len++] != '"')
        ;

    snprintf(outKey, outKeyLen, "%s", tx_parsed_json.json_key_positions[displayIdx - 1]);
    outKey[key_len - 1] = '\0';

    char tmpBuf[256];
    snprintf(tmpBuf, sizeof(tmpBuf), "%s", tx_parsed_json.json_value_positions[displayIdx - 1]);
    tmpBuf[tx_parsed_json.json_value_lengths[displayIdx - 1]] = '\0';
    pageString(outVal, outValLen, tmpBuf, pageIdx, pageCount);
    return zxerr_ok;
}

zxerr_t tx_getNumItems_arbitrary(uint8_t *num_items) {
    char *json = (char *) (tx_get_buffer() + TO_SIGN_SIZE + strlen("TX") + strlen(arbitrary_sign_domain) + 1);
    int count = 1;
    bool in_string = false;
    
    while (*json) {
        if (*json == '"') {
            in_string = !in_string;
        } else if (!in_string && *json == ':') {
            count++;
        }
        json++;
    }
    *num_items = count;
    return zxerr_ok;
}

// JSON parser for maximum of 1 nesting level in JSON
void tx_parse_arbitrary() {
    set_arbitrary_sign_domain((char *) (tx_get_buffer() + TO_SIGN_SIZE + strlen("TX")));

    char *json = (char *) (tx_get_buffer() + TO_SIGN_SIZE + strlen("TX") + strlen(arbitrary_sign_domain) + 1);

    uint8_t idx = 0;
    while (*json) {
        while (*json && *json != '"') json++;

        char *key_start = ++json;
        char *key_end = key_start;
        while (*key_end && *key_end != '"') key_end++;
        
        tx_parsed_json.json_key_positions[idx] = key_start;
        json = key_end + 1;

        while (*json && *json != ':') json++;
        if (*json == ':') json++;

        while (*json && (*json == ' ' || *json == '\t' || *json == '\n')) json++;
        
        if (*json == '"') {
            char *value_start = ++json;
            char *value_end = value_start;
            while (*value_end && *value_end != '"') value_end++;
            
            tx_parsed_json.json_value_positions[idx] = value_start;
            tx_parsed_json.json_value_lengths[idx] = value_end - value_start;
            json = value_end + 1;
        } else {
            char *value_start = json;
            char *value_end = value_start;
            
            if (*json == '[') {
                value_start = json;
                int bracket_count = 1;
                value_end = value_start + 1;
                
                while (*value_end && bracket_count > 0) {
                    if (*value_end == '[') bracket_count++;
                    if (*value_end == ']') bracket_count--;
                    value_end++;
                }
            } else {
                while (*value_end && *value_end != ',' && *value_end != '}') value_end++;
            }
            
            tx_parsed_json.json_value_positions[idx] = value_start;
            tx_parsed_json.json_value_lengths[idx] = value_end - value_start;
            json = value_end + 1;
        }
        idx++;
    }
}