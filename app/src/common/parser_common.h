/*******************************************************************************
*  (c) 2018 - 2022 Zondax AG
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

#ifdef __cplusplus
extern "C" {
#endif

#include "parser_txdef.h"
#include <stdint.h>
#include <stddef.h>

#define CHECK_ERROR(__CALL) { \
    parser_error_t __err = __CALL;  \
    CHECK_APP_CANARY()  \
    if (__err!=parser_ok) return __err;}

typedef enum {
    // Generic errors
    parser_ok = 0,
    parser_no_data = 1,
    parser_init_context_empty = 2,
    parser_display_idx_out_of_range = 3,
    parser_display_page_out_of_range = 4,
    parser_unexpected_error = 5,
    parser_blindsign_mode_required = 6,

    // Coin generic
    parser_unexpected_type = 7,
    parser_unexpected_method = 8,
    parser_unexpected_buffer_end = 9,
    parser_unexpected_value = 10,
    parser_unexpected_number_items = 11,
    parser_unexpected_version = 12,
    parser_unexpected_characters = 13,
    parser_unexpected_field = 14,
    parser_duplicated_field = 15,
    parser_value_out_of_range = 16,
    parser_invalid_address = 17,
    parser_unexpected_chain = 18,
    parser_missing_field = 19,
    parser_query_no_results = 20,
    parser_program_fields_too_long = 21,
    parser_too_many_extra_pages = 22,
    parser_buffer_too_small = 23,

    parser_unknown_transaction = 24,

    parser_key_not_found = 25,

    //Msgpack specific
    parser_msgpack_unexpected_type = 26,
    parser_msgpack_unexpected_key = 27,

    parser_msgpack_map_type_expected = 28,
    parser_msgpack_map_type_not_supported = 29,

    parser_msgpack_str_type_expected = 30,
    parser_msgpack_str_type_not_supported = 31,
    parser_msgpack_str_too_big = 32,

    parser_msgpack_bin_type_expected = 33,
    parser_msgpack_bin_type_not_supported = 34,
    parser_msgpack_bin_unexpected_size = 35,

    parser_msgpack_int_type_expected = 36,

    parser_msgpack_bool_type_expected = 37,

    parser_msgpack_array_unexpected_size = 38,
    parser_msgpack_array_too_big = 39,
    parser_msgpack_array_type_expected = 40,

    // Arbitrary sign specific
    parser_invalid_scope = 41,
    parser_failed_decoding = 42,
    parser_invalid_signer = 43,
    parser_missing_domain = 44,
    parser_missing_authenticated_data = 45,
    parser_bad_json = 46,
    parser_failed_domain_auth = 47,
    parser_failed_hd_path = 48,

} parser_error_t;

typedef struct {
    const uint8_t *buffer;
    uint16_t bufferLen;
    uint16_t offset;
    txn_content_e content;
    parser_tx_t *parser_tx_obj;
    parser_arbitrary_data_t *parser_arbitrary_data_obj;
} parser_context_t;

#ifdef __cplusplus
}
#endif
