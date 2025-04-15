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
#pragma once

#include "jsmn.h"

#define MAX_NUMBER_OF_JSMN_TOKENS 80

typedef struct {
    jsmntok_t *tokens;
    uint16_t numberOfTokens;
} parsed_json_t;

parsed_json_t parser_json_get_parsed_json();

parser_error_t parser_json_parse(const char *json, size_t json_len, parser_context_t *ctx, uint8_t *num_items);

parser_error_t parser_json_object_get_element_count(uint16_t object_token_index, uint16_t *element_count);

parser_error_t parser_json_object_get_nth_key(uint16_t object_token_index, uint16_t object_element_index,
                                  uint16_t *token_index);

parser_error_t parser_json_object_get_nth_value(uint16_t object_token_index, uint16_t object_element_index,
                                    uint16_t *key_index);

parser_error_t parser_getJsonItemFromTokenIndex(const char *jsonBuffer, uint16_t token_index, char *outVal, uint16_t outValLen);

parser_error_t parser_json_check_canonical(const char *data, uint16_t data_len);
