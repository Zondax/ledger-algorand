/*******************************************************************************
*  (c) 2019 Zondax GmbH
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

#include "parser_impl.h"
#include "msgpack.h"

parser_tx_t parser_tx_obj;

DEC_READFIX_UNSIGNED(8);
DEC_READFIX_UNSIGNED(16);
DEC_READFIX_UNSIGNED(32);
DEC_READFIX_UNSIGNED(64);

parser_error_t parser_init_context(parser_context_t *ctx,
                                   const uint8_t *buffer,
                                   uint16_t bufferSize) {
    ctx->offset = 0;
    ctx->buffer = NULL;
    ctx->bufferLen = 0;

    if (bufferSize == 0 || buffer == NULL) {
        // Not available, use defaults
        return parser_init_context_empty;
    }

    ctx->buffer = buffer;
    ctx->bufferLen = bufferSize;
    return parser_ok;
}

parser_error_t parser_init(parser_context_t *ctx, const uint8_t *buffer, uint16_t bufferSize) {
    CHECK_ERROR(parser_init_context(ctx, buffer, bufferSize))
    return parser_ok;
}

static uint8_t getMsgPackType(uint8_t byte)
{
    if (byte >= FIXMAP_0 && byte <= FIXARR_15) {
        return FIXMAP_0;
    } else if (byte >= FIXSTR_0 && byte <= FIXSTR_31) {
        return FIXSTR_0;
    }
    return byte;
}

parser_error_t _readMap(parser_context_t *c, uint16_t *mapItems)
{
    uint8_t byte = 0;
    CHECK_ERROR(_readUInt8(c, &byte))

    switch (getMsgPackType(byte)) {
        case FIXMAP_0:
            *mapItems = byte - FIXMAP_0;
        break;

        case MAP16:
            CHECK_ERROR(_readUInt16(c, mapItems))
        break;

        case MAP32:
            return parser_msgpack_map_type_not_supported;
        break;

        default:
            return parser_msgpack_map_type_expected;
    }
    return parser_ok;
}

parser_error_t _readBytes(parser_context_t *c, uint8_t *buff, uint16_t buffLen)
{
    CTX_CHECK_AVAIL(c, buffLen)
    MEMCPY(buff, (c->buffer + c->offset), buffLen);
    CTX_CHECK_AND_ADVANCE(c, buffLen)
    return parser_ok;
}

parser_error_t _readString(parser_context_t *c, uint8_t *buff, uint16_t buffLen)
{
    uint8_t byte = 0;
    uint8_t strLen = 0;
    CHECK_ERROR(_readUInt8(c, &byte))
    memset(buff, 0, buffLen);

    switch (getMsgPackType(byte)) {
    case FIXSTR_0:
        strLen = byte - FIXSTR_0;
        break;

    case STR8:
        CHECK_ERROR(_readUInt8(c, &strLen))
        break;

    case STR16:
        return parser_msgpack_str_type_not_supported;
        break;

    case STR32:
        return parser_msgpack_str_type_not_supported;
        break;

    default:
        return parser_msgpack_str_type_expected;
        break;
    }

    if (strLen >= buffLen) {
        return parser_msgpack_str_too_big;
    }
    CHECK_ERROR(_readBytes(c, buff, strLen))
    return parser_ok;
}

static parser_error_t _readTxType(parser_context_t *c, parser_tx_t *v)
{
    v->type = TX_UNKNOWN;
    uint8_t buff[16] = {0};
    CHECK_ERROR(_readString(c, buff, sizeof(buff)))

    if (strcmp((char*)buff, "pay") == 0) {
        v->type = TX_PAYMENT;
    } else if (strcmp((char*)buff, "keyreg") == 0) {
        v->type = TX_KEYREG;
    } else if (strcmp((char*)buff, "axfer") == 0) {
        v->type = TX_ASSET_XFER;
    } else if (strcmp((char*)buff, "afrz") == 0) {
        v->type = TX_ASSET_FREEZE;
    } else if (strcmp((char*)buff, "acfg") == 0) {
        v->type = TX_ASSET_CONFIG;
    } else if (strcmp((char*)buff, "appl") == 0) {
        v->type = TX_APPLICATION;
    }
    return parser_ok;
}

parser_error_t _readInteger(parser_context_t *c, uint64_t* value)
{
    uint8_t intType = 0;
    CHECK_ERROR(_readBytes(c, &intType, 1))

    if (intType >= FIXINT_0 && intType <= FIXINT_127) {
        *value = intType - FIXINT_0;
        return parser_ok;
    }

    switch (intType)
    {
    case UINT8: {
        uint8_t tmp = 0;
        CHECK_ERROR(_readUInt8(c, &tmp))
        *value = (uint64_t)tmp;
        break;
    }
    case UINT16: {
        uint16_t tmp = 0;
        CHECK_ERROR(_readUInt16(c, &tmp))
        *value = (uint64_t)tmp;
        break;
    }
    case UINT32: {
        uint32_t tmp = 0;
        CHECK_ERROR(_readUInt32(c, &tmp))
        *value = (uint64_t)tmp;
        break;
    }
    case UINT64: {
        CHECK_ERROR(_readUInt64(c, value))
        break;
    }
    default:
        return parser_msgpack_int_type_expected;
        break;
    }
    return parser_ok;
}

static parser_error_t _readBinFixed(parser_context_t *c, uint8_t *buff, uint16_t bufferLen)
{
    uint8_t binType = 0;
    uint8_t binLen = 0;
    CHECK_ERROR(_readUInt8(c, &binType))
    switch (binType)
    {
        case BIN8: {
            CHECK_ERROR(_readUInt8(c, &binLen))
            break;
        }
        case BIN16:
        case BIN32: {
            return parser_msgpack_bin_type_not_supported;
            break;
        }
        default: {
            return parser_msgpack_bin_type_expected;
            break;
        }
    }

    if(binLen != bufferLen) {
        return parser_msgpack_bin_unexpected_size;
    }
    CHECK_ERROR(_readBytes(c, buff, bufferLen))
    return parser_ok;
}

static parser_error_t _readBin(parser_context_t *c, uint8_t *buff, uint16_t *bufferLen, uint16_t bufferMaxSize)
{
    uint8_t binType = 0;
    uint16_t binLen = 0;
    CHECK_ERROR(_readUInt8(c, &binType))
    switch (binType)
    {
        case BIN8: {
            uint8_t tmp = 0;
            CHECK_ERROR(_readUInt8(c, &tmp))
            binLen = (uint16_t)tmp;
            break;
        }
        case BIN16: {
            CHECK_ERROR(_readUInt16(c, &binLen))
            break;
        }
        case BIN32: {
            return parser_msgpack_bin_type_not_supported;
            break;
        }
        default: {
            return parser_msgpack_bin_type_expected;
            break;
        }
    }

    if(binLen > bufferMaxSize) {
        return parser_msgpack_bin_unexpected_size;
    }

    *bufferLen = binLen;
    CHECK_ERROR(_readBytes(c, buff, *bufferLen))
    return parser_ok;
}

parser_error_t _readBool(parser_context_t *c, uint8_t *value)
{
    uint8_t tmp = 0;
    CHECK_ERROR(_readUInt8(c, &tmp))
    switch (tmp)
    {
        case BOOL_TRUE: {
            *value = 1;
            break;
        }

        case BOOL_FALSE: {
            *value = 0;
            break;
        }
        default: {
            return parser_msgpack_bool_type_expected;
            break;
        }
    }
    return parser_ok;
}

static parser_error_t _readTxCommonParams(parser_context_t *c, parser_tx_t *v)
{
    //Read sender
    uint8_t binType = _readBytes(c, &binType, 1);

    switch (binType)
    {
    case BIN8:
        /* code */
        break;
    case BIN16:
    case BIN32:
        return parser_msgpack_bin_type_not_supported;
        break;
    default:
        return parser_msgpack_bin_type_expected;
        break;
    }

    return parser_ok;
}

static parser_error_t _readTxPayment(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

static parser_error_t _readTxKeyreg(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

static parser_error_t _readTxAssetXfer(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

static parser_error_t _readTxAssetFreeze(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

static parser_error_t _readTxAssetConfig(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

static parser_error_t _readTxApplication(parser_context_t *c, parser_tx_t *v)
{
    return parser_ok;
}

parser_error_t _read(parser_context_t *c, parser_tx_t *v)
{
    // {FT} Don't forget to read keys
    uint16_t map_elements = 0;
    CHECK_ERROR(_readMap(c, &map_elements))

    uint8_t key[32] = {0};
    CHECK_ERROR(_readString(c, key, sizeof(key)))
    if (strcmp((char*)key, KEY_TYPE) == 0) {
        _readTxType(c, v);
    }

    if(v->type == TX_UNKNOWN) {
        return paser_unknown_transaction;
    }

    _readTxCommonParams(c, v);

    switch (v->type)
    {
    case TX_PAYMENT:
        _readTxPayment(c, v);
        break;
    case TX_KEYREG:
        _readTxKeyreg(c, v);
        break;
    case TX_ASSET_XFER:
        _readTxAssetXfer(c, v);
        break;
    case TX_ASSET_FREEZE:
        _readTxAssetFreeze(c, v);
        break;
    case TX_ASSET_CONFIG:
        _readTxAssetConfig(c, v);
        break;
    case TX_APPLICATION:
        _readTxApplication(c, v);
        // Make safety check for TX_APPLICATION
        break;
    default:
        return paser_unknown_transaction;
        break;
    }
    // Verify if tx_type is always the first to come
    return parser_ok;
}


const char *parser_getErrorDescription(parser_error_t err) {
    switch (err) {
        case parser_ok:
            return "No error";
        case parser_no_data:
            return "No more data";
        case parser_init_context_empty:
            return "Initialized empty context";
        case parser_unexpected_buffer_end:
            return "Unexpected buffer end";
        case parser_unexpected_version:
            return "Unexpected version";
        case parser_unexpected_characters:
            return "Unexpected characters";
        case parser_unexpected_field:
            return "Unexpected field";
        case parser_duplicated_field:
            return "Unexpected duplicated field";
        case parser_value_out_of_range:
            return "Value out of range";
        case parser_unexpected_chain:
            return "Unexpected chain";
        case parser_query_no_results:
            return "item query returned no results";
        case parser_missing_field:
            return "missing field";
//////
        case parser_display_idx_out_of_range:
            return "display index out of range";
        case parser_display_page_out_of_range:
            return "display page out of range";
//////
        case parser_json_zero_tokens:
            return "JSON. Zero tokens";
        case parser_json_too_many_tokens:
            return "JSON. Too many tokens";
        case parser_json_incomplete_json:
            return "JSON string is not complete";
        case parser_json_contains_whitespace:
            return "JSON Contains whitespace in the corpus";
        case parser_json_is_not_sorted:
            return "JSON Dictionaries are not sorted";
        case parser_json_missing_chain_id:
            return "JSON Missing chain_id";
        case parser_json_missing_sequence:
            return "JSON Missing sequence";
        case parser_json_missing_fee:
            return "JSON Missing fee";
        case parser_json_missing_msgs:
            return "JSON Missing msgs";
        case parser_json_missing_account_number:
            return "JSON Missing account number";
        case parser_json_missing_memo:
            return "JSON Missing memo";
        case parser_json_unexpected_error:
            return "JSON Unexpected error";

        default:
            return "Unrecognized error code";
    }
}
