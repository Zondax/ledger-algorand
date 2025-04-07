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
    CHECK_ERROR(parser_json_object_get_element_count(0, &elements_in_json_object));
    *items_in_json = elements_in_json_object;

    return parser_ok;
}

parser_error_t parser_json_object_get_element_count(uint16_t object_token_index, uint16_t *element_count) {
    parsed_json_t *json = &parsed_json;
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

parser_error_t parser_json_object_get_nth_key(uint16_t object_token_index, uint16_t object_element_index,
                                  uint16_t *token_index) {
    parsed_json_t *json = &parsed_json;
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

parser_error_t parser_json_object_get_nth_value(uint16_t object_token_index, uint16_t object_element_index,
                                    uint16_t *key_index) {
    parsed_json_t *json = &parsed_json;

    if (object_token_index > json->numberOfTokens) {
        return parser_no_data;
    }

    CHECK_ERROR(parser_json_object_get_nth_key(object_token_index, object_element_index, key_index));
    (*key_index)++;

    return parser_ok;
}

parser_error_t parser_getJsonItemFromTokenIndex(const char *jsonBuffer, uint16_t token_index, char *outVal, uint16_t outValLen) {
    parsed_json_t *json = &parsed_json;
    jsmntok_t token = json->tokens[token_index];

    if (token.type == JSMN_STRING) {
        if (token.end - token.start > outValLen) {
            return parser_unexpected_buffer_end;
        }
        memcpy(outVal, jsonBuffer + token.start, token.end - token.start);
        outVal[token.end - token.start] = '\0';
    } else {
        return parser_bad_json;
    }

    return parser_ok;
}

static bool is_key_or_value(const char *pData, const char *data) {
    parsed_json_t *json = &parsed_json;
    uint16_t num_keys = 0;
    uint16_t key_token_index = 0;
    uint16_t value_token_index = 0;

    parser_json_object_get_element_count(0, &num_keys);

    for (uint16_t i = 0; i < num_keys; i++) {
        CHECK_ERROR(parser_json_object_get_nth_key(0, i, &key_token_index));
        jsmntok_t key_token = json->tokens[key_token_index];
        CHECK_ERROR(parser_json_object_get_nth_value(0, i, &value_token_index));
        jsmntok_t value_token = json->tokens[value_token_index];

        if (pData >= data + key_token.start && pData <= data + key_token.end) {
            return true;
        }

        if (pData >= data + value_token.start && pData <= data + value_token.end) {
            return true;
        }

        if (pData < data + value_token.start) {
            return false;
        }
    }
    return false;
}

parser_error_t parser_json_check_canonical(const char *data, uint16_t data_len) {
    uint16_t num_keys = 0;
    CHECK_ERROR(parser_json_object_get_element_count(0, &num_keys));

    /*
        Check there are no whitespaces outside of keys and values
        -> retrieve all offsets of keys and values (start and end) and check there are no whitespaces outside of them

        This is the blob with the JSON :

            +---------------------------------------------------------------------------------------------------------------+
            |                                                                                                               |
            +---------------------------------------------------------------------------------------------------------------+

        The JSMN tokens point to parts of the blob like this :

            +---------------------------------------------------------------------------------------------------------------+
            |                                                                                                               |
            +---------------------------------------------------------------------------------------------------------------+
                ^     ^      ^           ^     ^     ^     ^                       ^                                      
                |     |      |           |     |     |     |                       |                                      
                +-----+      +-----------+     +-----+     +-----------------------+                                      
    Tokens :    firstKey,    firstValue,       secondKey,  secondValue,                  ...

        We are only interested in detecting whitespaces in the following ranges (marked as x):

            +---------------------------------------------------------------------------------------------------------------+
            |xxx       xxxxxx             xxxxx       xxxxx                              ...                                |
            +---------------------------------------------------------------------------------------------------------------+
                ^     ^      ^           ^     ^     ^     ^                       ^                                      
                |     |      |           |     |     |     |                       |                                      
                +-----+      +-----------+     +-----+     +-----------------------+                                      

    */

    char *pData = (char *)data;
    while (pData < data + data_len) {
        if (!is_key_or_value(pData, data)) {
            if (*pData == ' ') {
                return parser_bad_json;
            }
        }
        pData++;
    }

    // Check if keys are sorted lexicographically
    char currentKey[100] = {0};
    char lastKey[100] = {0};

    for (uint16_t i = 0; i < num_keys; i++) {
        uint16_t key_token_index = 0;
        CHECK_ERROR(parser_json_object_get_nth_key(0, i, &key_token_index));
        CHECK_ERROR(parser_getJsonItemFromTokenIndex(data, key_token_index, currentKey, sizeof(currentKey)));

        if (strcmp(lastKey, currentKey) > 0) {
            return parser_bad_json;
        }

        strncpy(lastKey, currentKey, sizeof(lastKey) - 1);
    }

    // Check there are only ASCII characters
    for (uint16_t i = 0; i < data_len; i++) {
        if (data[i] < 32 || data[i] > 126) {
            return parser_bad_json;
        }
    }

    return parser_ok;
}
