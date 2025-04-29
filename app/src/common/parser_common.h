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

    // Coin generic
    parser_unexpected_type = 6,
    parser_unexpected_method = 7,
    parser_unexpected_buffer_end = 8,
    parser_unexpected_value = 9,
    parser_unexpected_number_items = 10,
    parser_unexpected_version = 11,
    parser_unexpected_characters = 12,
    parser_unexpected_field = 13,
    parser_duplicated_field = 14,
    parser_value_out_of_range = 15,
    parser_invalid_address = 16,
    parser_unexpected_chain = 17,
    parser_missing_field = 18,
    parser_query_no_results = 19,
    parser_program_fields_too_long = 20,
    parser_too_many_extra_pages = 21,
    parser_buffer_too_small = 22,

    parser_unknown_transaction = 23,

    parser_key_not_found = 24,

    //Msgpack specific
    parser_msgpack_unexpected_type = 25,
    parser_msgpack_unexpected_key = 26,

    parser_msgpack_map_type_expected = 27,
    parser_msgpack_map_type_not_supported = 28,

    parser_msgpack_str_type_expected = 29,
    parser_msgpack_str_type_not_supported = 30,
    parser_msgpack_str_too_big = 31,

    parser_msgpack_bin_type_expected = 32,
    parser_msgpack_bin_type_not_supported = 33,
    parser_msgpack_bin_unexpected_size = 34,

    parser_msgpack_int_type_expected = 35,

    parser_msgpack_bool_type_expected = 36,

    parser_msgpack_array_unexpected_size = 37,
    parser_msgpack_array_too_big = 38,
    parser_msgpack_array_type_expected = 39,

    // Arbitrary sign specific
    parser_invalid_scope = 40,
    parser_invalid_encoding = 41,
    parser_failed_decoding = 42,
    parser_invalid_signer = 43,
    parser_missing_domain = 44,
    parser_invalid_domain = 45,
    parser_missing_authenticated_data = 46,
    parser_bad_json = 47,
    parser_failed_domain_auth = 48,
    parser_failed_hd_path = 49,
    parser_invalid_request_id = 50,

    // CBOR specific
    parser_cbor_error_parser_init = 51,
    parser_cbor_error_invalid_type = 52,
    parser_cbor_error_map_entry = 53,
    parser_cbor_error_unexpected = 54,
    parser_cbor_error_out_of_memory = 55,
    parser_cbor_error_container = 56,
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
