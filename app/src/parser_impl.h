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

#include "parser_common.h"
#include <zxmacros.h>
#include "zxtypes.h"
#include "parser_txdef.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Checks that there are at least SIZE bytes available in the buffer
#define CTX_CHECK_AVAIL(CTX, SIZE) \
    if ( (CTX) == NULL || ((CTX)->offset + (SIZE)) > (CTX)->bufferLen) { return parser_unexpected_buffer_end; }

#define CTX_CHECK_AND_ADVANCE(CTX, SIZE) \
    CTX_CHECK_AVAIL((CTX), (SIZE))   \
    (CTX)->offset += (SIZE);

#define DEF_READARRAY(SIZE) \
    v->_ptr = c->buffer + c->offset; \
    CTX_CHECK_AND_ADVANCE(c, SIZE) \
    return parser_ok;

#define DEF_READFIX_UNSIGNED(BITS) parser_error_t _readUInt ## BITS(parser_context_t *ctx, uint ## BITS ##_t *value)
#define DEC_READFIX_UNSIGNED(BITS) parser_error_t _readUInt ## BITS(parser_context_t *ctx, uint ## BITS ##_t *value) \
{                                                                                           \
    if (value == NULL)  return parser_no_data;                                              \
    *value = 0u;                                                                            \
    for(uint8_t i=0u; i < (BITS##u>>3u); i++, ctx->offset++) {                              \
        if (ctx->offset >= ctx->bufferLen) return parser_unexpected_buffer_end;             \
        *value = (*value << 8) | (uint ## BITS ##_t) *(ctx->buffer + ctx->offset);          \
    }                                                                                       \
    return parser_ok;                                                                       \
}

parser_error_t _readBytes(parser_context_t *c, uint8_t *buff, uint16_t bufLen);

parser_error_t parser_init(parser_context_t *ctx,
                           const uint8_t *buffer,
                           uint16_t bufferSize,
                           txn_content_e content);

uint8_t _getNumItems();
uint8_t _getCommonNumItems();
uint8_t _getTxNumItems();
uint8_t _getNumJsonItems();

parser_error_t _read(parser_context_t *c, parser_tx_t *v);
parser_error_t _read_arbitrary_data(parser_context_t *c, parser_arbitrary_data_t *v);
parser_error_t _readMapSize(parser_context_t *c, uint16_t *mapItems);
parser_error_t _readArraySize(parser_context_t *c, uint8_t *mapItems);
parser_error_t _readString(parser_context_t *c, uint8_t *buff, uint16_t buffLen);
parser_error_t _readInteger(parser_context_t *c, uint64_t* value);
parser_error_t _readBool(parser_context_t *c, uint8_t *value);
parser_error_t _readBinFixed(parser_context_t *c, uint8_t *buff, uint16_t bufferLen);

parser_error_t _getAccount(parser_context_t *c, uint8_t* account, uint8_t account_idx, uint8_t num_accounts);
parser_error_t _getAppArg(parser_context_t *c, uint8_t **args, uint16_t* args_len, uint8_t args_idx, uint16_t max_args_len, uint8_t max_array_len);

DEF_READFIX_UNSIGNED(8);
DEF_READFIX_UNSIGNED(16);
DEF_READFIX_UNSIGNED(32);
DEF_READFIX_UNSIGNED(64);

typedef struct {
    uint8_t kty;
    int alg;
    uint8_t crv;
    bool found_alg;
    bool found_crv;
} credential_public_key_t;

typedef struct flags {
    uint8_t up: 1;     // Bit 0 User Presence
    uint8_t pad1: 2;   // Bits 1-2 (padding)
    uint8_t uv: 1;     // Bit 3 User Verified
    uint8_t pad2: 2;   // Bits 4-5 (padding)
    uint8_t at: 1;     // Bit 6 Attestation
    uint8_t ed: 1;     // Bit 7 Extensions
} flags_t;



#ifdef __cplusplus
}
#endif
