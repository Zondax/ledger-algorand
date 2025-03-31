/*******************************************************************************
*  (c) 2018 - 2025 Zondax AG
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

#include <stdint.h>
#include "parser_common.h"
#include "parser_impl.h"
#include "parser_json.h"
#include "jsmn.h"
#include <stdbool.h>
#include "zxmacros_ledger.h"

static parsed_json_t parsed_json;
static jsmn_parser p;
static jsmntok_t t[MAX_NUMBER_OF_JSMN_TOKENS];

parsed_json_t parser_json_get_parsed_json() {
    return parsed_json;
}

parser_error_t parser_json_parse(const char *json, size_t json_len, parser_context_t *ctx, uint8_t *items_in_json) {
    MEMZERO(&parsed_json, sizeof(parsed_json));
    jsmn_init(&p);
    int num_tokens = jsmn_parse(&p, json, json_len, t, MAX_NUMBER_OF_JSMN_TOKENS);

    if (num_tokens < 0) {
        return parser_bad_json;
    }

    parsed_json.tokens = t;
    parsed_json.numberOfTokens = num_tokens;

    CTX_CHECK_AND_ADVANCE(ctx, json_len);

    uint16_t elements_in_json_object = 0;
    parser_json_object_get_element_count(&parsed_json, 0, &elements_in_json_object);
    *items_in_json = elements_in_json_object;

    return parser_ok;
}

parser_error_t parser_json_object_get_element_count(const parsed_json_t *json, uint16_t object_token_index, uint16_t *element_count) {
    *element_count = 0;
    if (object_token_index > json->numberOfTokens) {
        return parser_no_data;
    }

    jsmntok_t object_token = json->tokens[object_token_index];
    uint16_t token_index = object_token_index;
    uint16_t prev_element_end = object_token.start;
    token_index++;
    while (true) {
        if (token_index >= json->numberOfTokens) {
            break;
        }
        jsmntok_t key_token = json->tokens[token_index++];
        jsmntok_t value_token = json->tokens[token_index];
        if (key_token.start > object_token.end) {
            break;
        }
        if (key_token.start <= prev_element_end) {
            continue;
        }
        prev_element_end = value_token.end;
        (*element_count)++;
    }

    return parser_ok;
}

parser_error_t parser_json_object_get_nth_key(const parsed_json_t *json, uint16_t object_token_index, uint16_t object_element_index,
                                  uint16_t *token_index) {
    *token_index = object_token_index;
    if (object_token_index > json->numberOfTokens) {
        return parser_no_data;
    }

    jsmntok_t object_token = json->tokens[object_token_index];
    uint16_t element_count = 0;
    uint16_t prev_element_end = object_token.start;
    (*token_index)++;
    while (true) {
        if (*token_index >= json->numberOfTokens) {
            break;
        }
        jsmntok_t key_token = json->tokens[(*token_index)++];
        jsmntok_t value_token = json->tokens[*token_index];
        if (key_token.start > object_token.end) {
            break;
        }
        if (key_token.start <= prev_element_end) {
            continue;
        }
        prev_element_end = value_token.end;
        if (element_count == object_element_index) {
            (*token_index)--;
            return parser_ok;
        }
        element_count++;
    }

    return parser_no_data;
}

parser_error_t parser_json_object_get_nth_value(const parsed_json_t *json, uint16_t object_token_index, uint16_t object_element_index,
                                    uint16_t *key_index) {
    if (object_token_index > json->numberOfTokens) {
        return parser_no_data;
    }

    CHECK_ERROR(parser_json_object_get_nth_key(json, object_token_index, object_element_index, key_index));
    (*key_index)++;

    return parser_ok;
}