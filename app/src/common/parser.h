/*******************************************************************************
*   (c) 2018 - 2022 Zondax AG
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

#include "parser_impl.h"

// Arbitrary Sign
#define APDU_CODE_INVALID_SCOPE 0x6988
#define APDU_CODE_FAILED_DECODING 0x6989
#define APDU_CODE_INVALID_SIGNER 0x698A
#define APDU_CODE_MISSING_DOMAIN 0x698B
#define APDU_CODE_MISSING_AUTHENTICATED_DATA 0x698C
#define APDU_CODE_BAD_JSON 0x698D
#define APDU_CODE_FAILED_DOMAIN_AUTH 0x698E
#define APDU_CODE_FAILED_HD_PATH 0x698F

// Request ID in binary can be up to 255 bytes, so in base64 it can be up to 340 bytes
#define REQUEST_ID_MAX_LEN 255
#define BASE64_REQUEST_ID_MAX_LEN 340
const char *parser_getErrorDescription(parser_error_t err);
const char *parser_getMsgPackTypeDescription(uint8_t type);

uint16_t parser_mapParserErrorToSW(parser_error_t err);

/// parses a tx buffer
parser_error_t parser_parse(parser_context_t *ctx,
                            const uint8_t *data,
                            size_t dataLen,
                            void *tx_obj,
                            txn_content_e content);

/// verifies tx fields
parser_error_t parser_validate(parser_context_t *ctx);

//// returns the number of items in the current parsing context
parser_error_t parser_getNumItems(uint8_t *num_items);

// returns the number of json items in "data" for arbitrary signing
parser_error_t parser_getNumJsonItems(uint8_t *num_json_items);

// retrieves a readable output for each field / page
parser_error_t parser_getItem(parser_context_t *ctx,
                              uint8_t displayIdx,
                              char *outKey, uint16_t outKeyLen,
                              char *outVal, uint16_t outValLen,
                              uint8_t pageIdx, uint8_t *pageCount);

parser_error_t getItem(uint8_t index, uint8_t* displayIdx);

parser_error_t parser_jsonGetNthKey(parser_context_t *ctx, uint8_t displayIdx, char *outKey, uint16_t outKeyLen);
parser_error_t parser_jsonGetNthValue(parser_context_t *ctx, uint8_t displayIdx, char *outVal, uint16_t outValLen);

#ifdef __cplusplus
}
#endif
