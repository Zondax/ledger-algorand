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

#include "common/parser.h"
#include "parser_impl.h"
#include "parser_json.h"
#include "msgpack.h"
#include "app_mode.h"
#include "coin.h"
#include "picohash.h"
#include "apdu_codes.h"
#include "zxerror.h"
#include "jsmn.h"

#if defined(TARGET_NANOS) || defined(TARGET_NANOS2) || defined(TARGET_NANOX) || defined(TARGET_STAX) || defined(TARGET_FLEX)
#include "crypto.h"
#endif

static uint8_t num_items;
static uint8_t common_num_items;
static uint8_t tx_num_items;
static uint8_t num_json_items;

#define MAX_PARAM_SIZE 12
#define MAX_ITEM_ARRAY 50
static uint8_t itemArray[MAX_ITEM_ARRAY] = {0};
static uint8_t itemIndex = 0;

DEC_READFIX_UNSIGNED(8);
DEC_READFIX_UNSIGNED(16);
DEC_READFIX_UNSIGNED(32);
DEC_READFIX_UNSIGNED(64);

static parser_error_t addItem(uint8_t displayIdx);
static parser_error_t _findKey(parser_context_t *c, const char *key);

static parser_error_t _readSigner(parser_context_t *c, parser_arbitrary_data_t *v);
static parser_error_t _readScope(parser_context_t *c);
static parser_error_t _readEncoding(parser_context_t *c);
static parser_error_t _readData(parser_context_t *c, parser_arbitrary_data_t *v);
static parser_error_t _readDomain(parser_context_t *c, parser_arbitrary_data_t *v);
static parser_error_t _readAuthData(parser_context_t *c, parser_arbitrary_data_t *v);
static parser_error_t _readRequestId(parser_context_t *c, parser_arbitrary_data_t *v);

// Arbitrary Sign
#define APDU_CODE_INVALID_SCOPE 0x6988
#define APDU_CODE_FAILED_DECODING 0x6989
#define APDU_CODE_INVALID_SIGNER 0x698A
#define APDU_CODE_MISSING_DOMAIN 0x698B
#define APDU_CODE_MISSING_AUTHENTICATED_DATA 0x698C
#define APDU_CODE_BAD_JSON 0x698D
#define APDU_CODE_FAILED_DOMAIN_AUTH 0x698E
#define APDU_CODE_FAILED_HD_PATH 0x698F


#define SCOPE_AUTH 0x01
#define ENCODING_BASE64 0x01

#define DISPLAY_ITEM(type, len, counter)        \
    for(uint8_t j = 0; j < len; j++) {          \
        CHECK_ERROR(addItem(type))              \
        counter++;                              \
    }

#define DISPLAY_APP_ITEM(appIdx, len, counter, v)   \
    if (!app_mode_blindsign()) {                    \
        for(uint8_t j = 0; j < len; j++) {          \
            CHECK_ERROR(addItem(appIdx))            \
            counter++;                              \
        }                                           \
    }

#define DISPLAY_COMMON_ITEM(appIdx, len, counter, v)                                \
    if (v->type == TX_APPLICATION && app_mode_blindsign()) {                       \
        if (appIdx == IDX_COMMON_SENDER || appIdx == IDX_COMMON_REKEY_TO) {         \
            DISPLAY_ITEM(appIdx, len, counter)                                      \
        }                                                                           \
    } else {                                                                        \
        DISPLAY_ITEM(appIdx, len, counter)                                          \
    }

static parser_error_t parser_init_context(parser_context_t *ctx,
                                   const uint8_t *buffer,
                                   uint16_t bufferSize,
                                   txn_content_e content) {
    if (ctx == NULL || bufferSize == 0 || buffer == NULL) {
         return parser_init_context_empty;
    }

    ctx->offset = 0;
    ctx->buffer = NULL;
    ctx->bufferLen = 0;
    num_items = 0;
    common_num_items = 0;
    tx_num_items = 0;

    ctx->buffer = buffer;
    ctx->bufferLen = bufferSize;
    ctx->content = content;
    return parser_ok;
}

parser_error_t parser_init(parser_context_t *ctx, const uint8_t *buffer, uint16_t bufferSize, txn_content_e content) {
    CHECK_ERROR(parser_init_context(ctx, buffer, bufferSize, content))
    return parser_ok;
}

static parser_error_t initializeItemArray()
{
    for(uint8_t i = 0; i < MAX_ITEM_ARRAY; i++) {
        itemArray[i] = 0xFF;
    }
    itemIndex = 0;
    return parser_ok;
}

parser_error_t addItem(uint8_t displayIdx)
{
    if(itemIndex >= MAX_ITEM_ARRAY) {
        return parser_unexpected_buffer_end;
    }
    itemArray[itemIndex] = displayIdx;
    itemIndex++;

    return parser_ok;
}

parser_error_t getItem(uint8_t index, uint8_t* displayIdx)
{
    if(index >= itemIndex) {
        return parser_display_page_out_of_range;
    }
    *displayIdx = itemArray[index];
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

parser_error_t _readMapSize(parser_context_t *c, uint16_t *mapItems)
{
    if (c == NULL || mapItems == NULL) {
         return parser_unexpected_value;
    }

    uint8_t byte = 0;
    CHECK_ERROR(_readUInt8(c, &byte))

    switch (getMsgPackType(byte)) {
        case FIXMAP_0:
            *mapItems = (uint16_t) byte - FIXMAP_0;
        break;

        case MAP16:
            CHECK_ERROR(_readUInt16(c, mapItems))
        break;

        case MAP32:
            return parser_msgpack_map_type_not_supported;
        break;

        default:
            return parser_msgpack_unexpected_type;
    }
    return parser_ok;
}

parser_error_t _readArraySize(parser_context_t *c, uint8_t *arrayItems)
{
    uint8_t byte = 0;
    CHECK_ERROR(_readUInt8(c, &byte))

    if (byte >= FIXARR_0 && byte <= FIXARR_15) {
        *arrayItems = byte - FIXARR_0;
        return parser_ok;
    }
    switch (byte) {
        case ARR16: {
            uint16_t tmpItems = 0;
            CHECK_ERROR(_readUInt16(c, &tmpItems))
            if(tmpItems > UINT8_MAX) {
                return parser_unexpected_number_items;
            }
            *arrayItems = (uint8_t) tmpItems;
            return parser_ok;
        }
        case ARR32:
            // Not supported
            break;
    }

    return parser_msgpack_unexpected_type;
}

static parser_error_t _verifyBytes(parser_context_t *c, uint16_t buffLen)
{
    CTX_CHECK_AVAIL(c, buffLen)
    CTX_CHECK_AND_ADVANCE(c, buffLen)
    return parser_ok;
}

static parser_error_t _getPointerBytes(parser_context_t *c, const uint8_t **buff, uint16_t buffLen)
{
    CTX_CHECK_AVAIL(c, buffLen)
    *buff = c->buffer + c->offset;
    CTX_CHECK_AND_ADVANCE(c, buffLen)
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

parser_error_t _readBinFixed(parser_context_t *c, uint8_t *buff, uint16_t bufferLen)
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

static parser_error_t _readBinSize(parser_context_t *c, uint16_t *binSize)
{
    uint8_t binType = 0;
    CHECK_ERROR(_readUInt8(c, &binType))
    switch (binType)
    {
        case BIN8: {
            uint8_t tmp = 0;
            CHECK_ERROR(_readUInt8(c, &tmp))
            *binSize = (uint16_t)tmp;
            break;
        }
        case BIN16: {
            CHECK_ERROR(_readUInt16(c, binSize))
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
    return parser_ok;
}

static parser_error_t _verifyBin(parser_context_t *c, uint16_t *buffer_len, uint16_t max_buffer_len)
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

    if(binLen > max_buffer_len) {
        return parser_msgpack_bin_unexpected_size;
    }

    *buffer_len = binLen;
    CHECK_ERROR(_verifyBytes(c, *buffer_len))
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


static parser_error_t _getPointerBin(parser_context_t *c, const uint8_t **buff, uint16_t *bufferLen)
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

    *bufferLen = binLen;

    CHECK_ERROR(_getPointerBytes(c, buff, *bufferLen));


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

static parser_error_t _readAssetParams(parser_context_t *c, txn_asset_config *asset_config)
{
    uint8_t available_params[MAX_PARAM_SIZE];
    memset(available_params, 0xFF, MAX_PARAM_SIZE);

    uint16_t paramsSize = 0;
    CHECK_ERROR(_readMapSize(c, &paramsSize))

    if(paramsSize > MAX_PARAM_SIZE) {
        return parser_unexpected_number_items;
    }

    uint8_t key[10] = {0};
    for(uint16_t i = 0; i < paramsSize; i++) {
        CHECK_ERROR(_readString(c, key, sizeof(key)))

        if (strncmp((char*)key, KEY_APARAMS_TOTAL, strlen(KEY_APARAMS_TOTAL)) == 0) {
            CHECK_ERROR(_readInteger(c, &asset_config->params.total))
            available_params[IDX_CONFIG_TOTAL_UNITS] = IDX_CONFIG_TOTAL_UNITS;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_DEF_FROZEN, strlen(KEY_APARAMS_DEF_FROZEN)) == 0) {
            CHECK_ERROR(_readBool(c, &asset_config->params.default_frozen))
            available_params[IDX_CONFIG_FROZEN] = IDX_CONFIG_FROZEN;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_UNIT_NAME, strlen(KEY_APARAMS_UNIT_NAME)) == 0) {
            memset(asset_config->params.unitname, 0, sizeof(asset_config->params.unitname));
            CHECK_ERROR(_readString(c, (uint8_t*)asset_config->params.unitname, sizeof(asset_config->params.unitname)))
            available_params[IDX_CONFIG_UNIT_NAME] = IDX_CONFIG_UNIT_NAME;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_DECIMALS, strlen(KEY_APARAMS_DECIMALS)) == 0) {
            CHECK_ERROR(_readInteger(c, &asset_config->params.decimals))
            available_params[IDX_CONFIG_DECIMALS] = IDX_CONFIG_DECIMALS;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_ASSET_NAME, strlen(KEY_APARAMS_ASSET_NAME)) == 0) {
            memset(asset_config->params.assetname, 0, sizeof(asset_config->params.assetname));
            CHECK_ERROR(_readString(c, (uint8_t*)asset_config->params.assetname, sizeof(asset_config->params.assetname)))
            available_params[IDX_CONFIG_ASSET_NAME] = IDX_CONFIG_ASSET_NAME;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_URL, strlen(KEY_APARAMS_URL)) == 0) {
            memset(asset_config->params.url, 0, sizeof(asset_config->params.url));
            CHECK_ERROR(_readString(c, (uint8_t*)asset_config->params.url, sizeof(asset_config->params.url)))
            available_params[IDX_CONFIG_URL] = IDX_CONFIG_URL;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_METADATA_HASH, strlen(KEY_APARAMS_METADATA_HASH)) == 0) {
            CHECK_ERROR(_readBinFixed(c, asset_config->params.metadata_hash, sizeof(asset_config->params.metadata_hash)))
            available_params[IDX_CONFIG_METADATA_HASH] = IDX_CONFIG_METADATA_HASH;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_MANAGER, strlen(KEY_APARAMS_MANAGER)) == 0) {
            CHECK_ERROR(_readBinFixed(c, asset_config->params.manager, sizeof(asset_config->params.manager)))
            available_params[IDX_CONFIG_MANAGER] = IDX_CONFIG_MANAGER;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_RESERVE, strlen(KEY_APARAMS_RESERVE)) == 0) {
            CHECK_ERROR(_readBinFixed(c, asset_config->params.reserve, sizeof(asset_config->params.reserve)))
            available_params[IDX_CONFIG_RESERVE] = IDX_CONFIG_RESERVE;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_FREEZE, strlen(KEY_APARAMS_FREEZE)) == 0) {
            CHECK_ERROR(_readBinFixed(c, asset_config->params.freeze, sizeof(asset_config->params.freeze)))
            available_params[IDX_CONFIG_FREEZER] = IDX_CONFIG_FREEZER;
            continue;
        }

        if (strncmp((char*)key, KEY_APARAMS_CLAWBACK, strlen(KEY_APARAMS_CLAWBACK)) == 0) {
            CHECK_ERROR(_readBinFixed(c, asset_config->params.clawback, sizeof(asset_config->params.clawback)))
            available_params[IDX_CONFIG_CLAWBACK] = IDX_CONFIG_CLAWBACK;
            continue;
        }
    }

    for(uint8_t i = 0; i < MAX_PARAM_SIZE; i++) {
        switch (available_params[i])
        {
        case IDX_CONFIG_ASSET_ID:
            DISPLAY_ITEM(IDX_CONFIG_ASSET_ID, 1, tx_num_items)
            break;
        case IDX_CONFIG_TOTAL_UNITS:
            DISPLAY_ITEM(IDX_CONFIG_TOTAL_UNITS, 1, tx_num_items)
            break;
        case IDX_CONFIG_FROZEN:
            DISPLAY_ITEM(IDX_CONFIG_FROZEN, 1, tx_num_items)
            break;
        case IDX_CONFIG_UNIT_NAME:
            DISPLAY_ITEM(IDX_CONFIG_UNIT_NAME, 1, tx_num_items)
            break;
        case IDX_CONFIG_DECIMALS:
            DISPLAY_ITEM(IDX_CONFIG_DECIMALS, 1, tx_num_items)
            break;
        case IDX_CONFIG_ASSET_NAME:
            DISPLAY_ITEM(IDX_CONFIG_ASSET_NAME, 1, tx_num_items)
            break;
        case IDX_CONFIG_URL:
            DISPLAY_ITEM(IDX_CONFIG_URL, 1, tx_num_items)
            break;
        case IDX_CONFIG_METADATA_HASH:
            DISPLAY_ITEM(IDX_CONFIG_METADATA_HASH, 1, tx_num_items)
            break;
        case IDX_CONFIG_MANAGER:
            DISPLAY_ITEM(IDX_CONFIG_MANAGER, 1, tx_num_items)
            break;
        case IDX_CONFIG_RESERVE:
            DISPLAY_ITEM(IDX_CONFIG_RESERVE, 1, tx_num_items)
            break;
        case IDX_CONFIG_FREEZER:
            DISPLAY_ITEM(IDX_CONFIG_FREEZER, 1, tx_num_items)
            break;
        case IDX_CONFIG_CLAWBACK:
            DISPLAY_ITEM(IDX_CONFIG_CLAWBACK, 1, tx_num_items)
            break;
        default:
            break;
        }
    }
    return parser_ok;
}

parser_error_t _verifyAppArgs(parser_context_t *c, uint16_t args_len[], uint8_t *args_array_len, size_t max_array_len)
{
    CHECK_ERROR(_readArraySize(c, args_array_len))
    if (*args_array_len > max_array_len) {
        return parser_msgpack_array_too_big;
    }

    for (uint8_t i = 0; i < *args_array_len; i++) {
        CHECK_ERROR(_verifyBin(c, &args_len[i], MAX_ARGLEN))
    }

    return parser_ok;
}

parser_error_t _getAppArg(parser_context_t *c, uint8_t **args, uint16_t* args_len, uint8_t args_idx, uint16_t max_args_len, uint8_t max_array_len)
{
    uint8_t tmp_array_len = 0;
    CHECK_ERROR(_findKey(c, KEY_APP_ARGS))
    CHECK_ERROR(_readArraySize(c, &tmp_array_len))

    if(tmp_array_len > max_array_len || args_idx >= tmp_array_len) {
        return parser_unexpected_number_items;
    }

    for(uint8_t i = 0; i < args_idx + 1; i++) {
        CHECK_ERROR(_verifyBin(c, args_len, max_args_len))
    }

    if (c->offset < *args_len) {
        return parser_unexpected_value;
    }
    (*args) = (uint8_t*)(c->buffer + c->offset - *args_len);
    return parser_ok;
}

parser_error_t _readAppArgs(parser_context_t *c, uint8_t args[][MAX_ARGLEN], size_t args_len[], size_t *argsSize, size_t maxArgs)
{
    uint8_t tmpFIX = 0;
    CHECK_ERROR(_readArraySize(c, &tmpFIX))
    *argsSize = tmpFIX;

    if (*argsSize > maxArgs) {
        return parser_msgpack_array_too_big;
    }

    for (size_t i = 0; i < *argsSize; i++) {
        CHECK_ERROR(_readBin(c, args[i], (uint16_t*)&args_len[i], MAX_ARGLEN))
    }

    return parser_ok;
}

parser_error_t _readAccountsSize(parser_context_t *c, uint8_t *numAccounts, uint8_t maxAccounts)
{
    CHECK_ERROR(_readArraySize(c, numAccounts))
    if (*numAccounts > maxAccounts) {
        return parser_msgpack_array_too_big;
    }
    return parser_ok;
}

parser_error_t _getAccount(parser_context_t *c, uint8_t* account, uint8_t account_idx, uint8_t num_accounts)
{
    uint8_t tmp_num_accounts = 0;
    CHECK_ERROR(_findKey(c, KEY_APP_ACCOUNTS))
    CHECK_ERROR(_readAccountsSize(c, &tmp_num_accounts, num_accounts))
    if(tmp_num_accounts != num_accounts || account_idx >= num_accounts) {
        return parser_unexpected_number_items;
    }
    // Read until we get the right account index
    for (uint8_t i = 0; i < account_idx + 1; i++) {
        CHECK_ERROR(_readBinFixed(c, account, ACCT_SIZE))
    }
    return parser_ok;
}

parser_error_t _verifyAccounts(parser_context_t *c, uint8_t* num_accounts, uint8_t maxNumAccounts)
{
    uint8_t tmpBuf[ACCT_SIZE] = {0};
    CHECK_ERROR(_readAccountsSize(c, num_accounts, maxNumAccounts))
    for (uint8_t i = 0; i < *num_accounts; i++) {
        CHECK_ERROR(_readBinFixed(c, tmpBuf, sizeof(tmpBuf)))
    }
    return parser_ok;
}

parser_error_t _readStateSchema(parser_context_t *c, state_schema *schema)
{
    uint16_t mapSize = 0;
    CHECK_ERROR(_readMapSize(c, &mapSize))
    uint8_t key[32];
    for (uint16_t i = 0; i < mapSize; i++) {
        CHECK_ERROR(_readString(c, key, sizeof(key)))
        if (strncmp((char*)key, KEY_SCHEMA_NUI, sizeof(KEY_SCHEMA_NUI)) == 0) {
            CHECK_ERROR(_readInteger(c, &schema->num_uint))
        } else if (strncmp((char*)key, KEY_SCHEMA_NBS, sizeof(KEY_SCHEMA_NBS)) == 0) {
            CHECK_ERROR(_readInteger(c, &schema->num_byteslice))
        } else {
            return parser_msgpack_unexpected_key;
        }
    }
    return parser_ok;
}

parser_error_t _readArrayU64(parser_context_t *c, uint64_t elements[], uint8_t *num_elements, uint8_t max_elements)
{
    CHECK_ERROR(_readArraySize(c, num_elements))
    if (*num_elements > max_elements) {
        return parser_msgpack_array_too_big;
    }

    for (size_t i = 0; i < *num_elements; i++) {
        CHECK_ERROR(_readInteger(c, &elements[i]))
    }
    return parser_ok;
}

__Z_INLINE parser_error_t _readBoxElement(parser_context_t *c, box *box) {

    uint8_t key[2] = {0};
    uint16_t mapSize = 0;
    CHECK_ERROR(_readMapSize(c, &mapSize))
    box->i = 0;
    box->n_len = 0;
    box->n = NULL;

    for (uint16_t index = 0; index < mapSize; index++) {
        CHECK_ERROR(_readString(c, key, sizeof(key)))
        if (strncmp((char*)key, KEY_APP_BOX_INDEX, sizeof(KEY_APP_BOX_INDEX)) == 0) {
            CHECK_ERROR(_readUInt8(c, &box->i))

        } else if (strncmp((char*)key, KEY_APP_BOX_NAME, sizeof(KEY_APP_BOX_NAME)) == 0) {
            CHECK_ERROR(_getPointerBin(c, &box->n, &box->n_len))

            if (box->n_len > BOX_NAME_MAX_LENGTH) {
                return parser_value_out_of_range;
            }
        } else {
            return parser_unexpected_error;
        }
    }

    return parser_ok;
}

parser_error_t _readBoxes(parser_context_t *c, box boxes[], uint8_t *num_elements)
{
    CHECK_ERROR(_readArraySize(c, num_elements))
    if (*num_elements > MAX_FOREIGN_APPS) {
        return parser_msgpack_array_too_big;
    }

    for (size_t j = 0; j < *num_elements; j++) {
        CHECK_ERROR(_readBoxElement(c, &boxes[j]))
    }

    return parser_ok;
}

static parser_error_t _readTxType(parser_context_t *c, parser_tx_t *v)
{
    char typeStr[10] = {0};
    CHECK_ERROR(_findKey(c, KEY_COMMON_TYPE))
    CHECK_ERROR(_readString(c, (uint8_t*) typeStr, sizeof(typeStr)))

    if (strncmp(typeStr, KEY_TX_PAY, sizeof(KEY_TX_PAY)) == 0) {
        v->type = TX_PAYMENT;
    } else if (strncmp(typeStr, KEY_TX_KEYREG, sizeof(KEY_TX_KEYREG)) == 0) {
        v->type = TX_KEYREG;
    } else if (strncmp(typeStr, KEY_TX_ASSET_XFER, sizeof(KEY_TX_ASSET_XFER)) == 0) {
        v->type = TX_ASSET_XFER;
    } else if (strncmp(typeStr, KEY_TX_ASSET_FREEZE, sizeof(KEY_TX_ASSET_FREEZE)) == 0) {
        v->type = TX_ASSET_FREEZE;
    } else if (strncmp(typeStr, KEY_TX_ASSET_CONFIG, sizeof(KEY_TX_ASSET_CONFIG)) == 0) {
        v->type = TX_ASSET_CONFIG;
    } else if (strncmp(typeStr, KEY_TX_APPLICATION, sizeof(KEY_TX_APPLICATION)) == 0) {
        v->type = TX_APPLICATION;
    } else {
        v->type = TX_UNKNOWN;
        return parser_no_data;
    }

    return parser_ok;
}

static parser_error_t _readTxCommonParams(parser_context_t *c, parser_tx_t *v)
{
    common_num_items = 0;

    MEMZERO(v->rekey, sizeof(v->rekey));

    CHECK_ERROR(_findKey(c, KEY_COMMON_SENDER))
    CHECK_ERROR(_readBinFixed(c, v->sender, sizeof(v->sender)))
    DISPLAY_COMMON_ITEM(IDX_COMMON_SENDER, 1, common_num_items, v)

    if (_findKey(c, KEY_COMMON_LEASE) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->lease, sizeof(v->lease)))
        DISPLAY_COMMON_ITEM(IDX_COMMON_LEASE, 1, common_num_items, v)
    }

    if (_findKey(c, KEY_COMMON_REKEY) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->rekey, sizeof(v->rekey)))
        DISPLAY_COMMON_ITEM(IDX_COMMON_REKEY_TO, 1, common_num_items, v)
    }

    v->fee = 0;
    if (_findKey(c, KEY_COMMON_FEE) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->fee))
    }
    DISPLAY_COMMON_ITEM(IDX_COMMON_FEE, 1, common_num_items, v)

    if (_findKey(c, KEY_COMMON_GEN_ID) == parser_ok) {
        CHECK_ERROR(_readString(c, (uint8_t*)v->genesisID, sizeof(v->genesisID)))
        DISPLAY_COMMON_ITEM(IDX_COMMON_GEN_ID, 1, common_num_items, v)
    }

    CHECK_ERROR(_findKey(c, KEY_COMMON_GEN_HASH))
    CHECK_ERROR(_readBinFixed(c, v->genesisHash, sizeof(v->genesisHash)))
    DISPLAY_COMMON_ITEM(IDX_COMMON_GEN_HASH, 1, common_num_items, v)

    if (_findKey(c, KEY_COMMON_GROUP_ID) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->groupID, sizeof(v->groupID)))
        DISPLAY_COMMON_ITEM(IDX_COMMON_GROUP_ID, 1, common_num_items, v)
    }

    if (_findKey(c, KEY_COMMON_NOTE) == parser_ok) {
        CHECK_ERROR(_readBinSize(c, &v->note_len))
        if(v->note_len > MAX_NOTE_LEN) {
            return parser_unexpected_value;
        }
        DISPLAY_COMMON_ITEM(IDX_COMMON_NOTE, 1, common_num_items, v)
    }

    // First and Last valid won't be display --> don't count them
    CHECK_ERROR(_findKey(c, KEY_COMMON_FIRST_VALID))
    CHECK_ERROR(_readInteger(c, &v->firstValid))

    CHECK_ERROR(_findKey(c, KEY_COMMON_LAST_VALID))
    CHECK_ERROR(_readInteger(c, &v->lastValid))

    return parser_ok;
}

static parser_error_t _verifyValue(parser_context_t *c) {
    if (c == NULL) return parser_unexpected_error;

    CHECK_APP_CANARY()

    union {
        uint8_t u8_number;
        uint16_t u16_number;
        uint64_t u64_number;
    } tmp;

    uint8_t valueType = 0;
    CHECK_ERROR(_readUInt8(c, &valueType))

    // Point to where value type is defined
    c->offset--;

    if (valueType <= FIXINT_127 || (valueType >= UINT8 && valueType <= UINT64)) {
        CHECK_ERROR(_readInteger(c, &tmp.u64_number))

    } else if (valueType <= FIXMAP_15 || valueType == MAP16) {
        CHECK_ERROR(_readMapSize(c, &tmp.u16_number))
        const uint16_t mapLen = tmp.u16_number;
        for (uint16_t i = 0; i < mapLen; i++) {
            // Check key
            CHECK_ERROR(_verifyValue(c))
            // Check value
            CHECK_ERROR(_verifyValue(c))
        }

    } else if (valueType <= FIXARR_15 || valueType == ARR16) {
        CHECK_ERROR(_readArraySize(c, &tmp.u8_number))
        const uint8_t arrLen = tmp.u8_number;
        for (uint8_t i = 0; i < arrLen; i++) {
            CHECK_ERROR(_verifyValue(c))
        }

    } else if (valueType <= FIXSTR_31) {
        c->offset++;
        const uint8_t strLen = valueType - FIXSTR_0;
        CHECK_ERROR(_verifyBytes(c, strLen))

    } else if (valueType == STR8) {
        c->offset++;
        uint8_t strLen = 0;
        CHECK_ERROR(_readUInt8(c, &strLen))
        CHECK_ERROR(_verifyBytes(c, strLen))

    } else if (valueType == BOOL_FALSE || valueType == BOOL_TRUE) {
        CHECK_ERROR(_readBool(c, &tmp.u8_number))

    } else if (valueType == BIN8 || valueType == BIN16) {
        CHECK_ERROR(_verifyBin(c, &tmp.u16_number, UINT16_MAX))

    } else {
        return parser_unexpected_value;
    }

    return parser_ok;
}
parser_error_t _findKey(parser_context_t *c, const char *key) {
    uint8_t tmpKey[20] = {0};

    // Process buffer from start
    c->offset = 0;
    uint16_t keysLen = 0;
    CHECK_ERROR(_readMapSize(c, &keysLen))
    for (uint16_t i = 0; i < keysLen; i++) {
        CHECK_ERROR(_readString(c, tmpKey, sizeof(tmpKey)))
        if (strncmp((char*)tmpKey, key, strlen(key)) == 0) {
            return parser_ok;
        }
        CHECK_ERROR(_verifyValue(c))
    }

    return parser_no_data;
}

static parser_error_t _readTxPayment(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    MEMZERO(v->payment.close, sizeof(v->payment.close));

    CHECK_ERROR(_findKey(c, KEY_PAY_RECEIVER))
    CHECK_ERROR(_readBinFixed(c, v->payment.receiver, sizeof(v->payment.receiver)))
    DISPLAY_ITEM(IDX_PAYMENT_RECEIVER, 1, tx_num_items)

    v->payment.amount = 0;
    if (_findKey(c, KEY_PAY_AMOUNT) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->payment.amount))
    }
    DISPLAY_ITEM(IDX_PAYMENT_AMOUNT, 1, tx_num_items)

    if (_findKey(c, KEY_PAY_CLOSE) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->payment.close, sizeof(v->payment.close)))
        DISPLAY_ITEM(IDX_PAYMENT_CLOSE_TO, 1, tx_num_items)
    }

    return parser_ok;
}

static parser_error_t _readTxKeyreg(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    if (_findKey(c, KEY_VOTE_PK) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->keyreg.votepk, sizeof(v->keyreg.votepk)))
        DISPLAY_ITEM(IDX_KEYREG_VOTE_PK, 1, tx_num_items)
    }

    if (_findKey(c, KEY_VRF_PK) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->keyreg.vrfpk, sizeof(v->keyreg.vrfpk)))
        DISPLAY_ITEM(IDX_KEYREG_VRF_PK, 1, tx_num_items)
    }

    if (_findKey(c, KEY_SPRF_PK) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->keyreg.sprfkey, sizeof(v->keyreg.sprfkey)))
        DISPLAY_ITEM(IDX_KEYREG_SPRF_PK, 1, tx_num_items)
    }

    if (_findKey(c, KEY_VOTE_FIRST) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->keyreg.voteFirst))
        DISPLAY_ITEM(IDX_KEYREG_VOTE_FIRST, 1, tx_num_items)

        CHECK_ERROR(_findKey(c, KEY_VOTE_LAST))
        CHECK_ERROR(_readInteger(c, &v->keyreg.voteLast))
        DISPLAY_ITEM(IDX_KEYREG_VOTE_LAST, 1, tx_num_items)
    }

    if (_findKey(c, KEY_VOTE_KEY_DILUTION) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->keyreg.keyDilution))
        DISPLAY_ITEM(IDX_KEYREG_KEY_DILUTION, 1, tx_num_items)
    }

    if (_findKey(c, KEY_VOTE_NON_PART_FLAG) == parser_ok) {
        CHECK_ERROR(_readBool(c, &v->keyreg.nonpartFlag))
    }
    DISPLAY_ITEM(IDX_KEYREG_PARTICIPATION, 1, tx_num_items)

    return parser_ok;
}

static parser_error_t _readTxAssetXfer(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    MEMZERO(v->asset_xfer.close, sizeof(v->asset_xfer.close));

    CHECK_ERROR(_findKey(c, KEY_XFER_ID))
    CHECK_ERROR(_readInteger(c, &v->asset_xfer.id))
    DISPLAY_ITEM(IDX_XFER_ASSET_ID, 1, tx_num_items)

    v->asset_xfer.amount = 0;
    if (_findKey(c, KEY_XFER_AMOUNT) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->asset_xfer.amount))
    }
    DISPLAY_ITEM(IDX_XFER_AMOUNT, 1, tx_num_items)

    CHECK_ERROR(_findKey(c, KEY_XFER_RECEIVER))
    CHECK_ERROR(_readBinFixed(c, v->asset_xfer.receiver, sizeof(v->asset_xfer.receiver)))
    DISPLAY_ITEM(IDX_XFER_DESTINATION, 1, tx_num_items)

    if (_findKey(c, KEY_XFER_SENDER) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->asset_xfer.sender, sizeof(v->asset_xfer.sender)))
        DISPLAY_ITEM(IDX_XFER_SOURCE, 1, tx_num_items)
    }

    if (_findKey(c, KEY_XFER_CLOSE) == parser_ok) {
        CHECK_ERROR(_readBinFixed(c, v->asset_xfer.close, sizeof(v->asset_xfer.close)))
        DISPLAY_ITEM(IDX_XFER_CLOSE, 1, tx_num_items)
    }

    return parser_ok;
}

static parser_error_t _readTxAssetFreeze(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    CHECK_ERROR(_findKey(c, KEY_FREEZE_ID))
    CHECK_ERROR(_readInteger(c, &v->asset_freeze.id))
    DISPLAY_ITEM(IDX_FREEZE_ASSET_ID, 1, tx_num_items)

    CHECK_ERROR(_findKey(c, KEY_FREEZE_ACCOUNT))
    CHECK_ERROR(_readBinFixed(c, v->asset_freeze.account, sizeof(v->asset_freeze.account)))
    DISPLAY_ITEM(IDX_FREEZE_ACCOUNT, 1, tx_num_items)

    if (_findKey(c, KEY_FREEZE_FLAG) == parser_ok) {
        if (_readBool(c, &v->asset_freeze.flag) != parser_ok) {
            v->asset_freeze.flag = 0x00;
        }
    }
    DISPLAY_ITEM(IDX_FREEZE_FLAG, 1, tx_num_items)

    return parser_ok;
}

static parser_error_t _readTxAssetConfig(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    if (_findKey(c, KEY_CONFIG_ID) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &v->asset_config.id))
        DISPLAY_ITEM(IDX_CONFIG_ASSET_ID, 1, tx_num_items)
    }

    if (_findKey(c, KEY_CONFIG_PARAMS) == parser_ok) {
        CHECK_ERROR(_readAssetParams(c, &v->asset_config))
    }

    return parser_ok;
}

static parser_error_t _readTxApplication(parser_context_t *c, parser_tx_t *v)
{
    tx_num_items = 0;
    txn_application *application = &v->application;
    application->num_boxes = 0;
    application->num_foreign_apps = 0;
    application->num_foreign_assets = 0;
    application->num_accounts = 0;
    application->num_app_args = 0;
    application->extra_pages = 0;
    application->oncompletion = NOOPOC;
    application->aprog_len = 0;
    application->cprog_len = 0;

    if (_findKey(c, KEY_APP_ID) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &application->id))
    }
    DISPLAY_APP_ITEM(IDX_APP_ID, 1, tx_num_items, v)

    if (_findKey(c, KEY_APP_ONCOMPLETION) == parser_ok) {
        CHECK_ERROR(_readInteger(c, &application->oncompletion))
    }
    DISPLAY_APP_ITEM(IDX_ON_COMPLETION, 1, tx_num_items, v)

    if (_findKey(c, KEY_APP_BOXES) == parser_ok) {
        CHECK_ERROR(_readBoxes(c, application->boxes, &application->num_boxes))
        DISPLAY_APP_ITEM(IDX_BOXES, application->num_boxes, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_FOREIGN_APPS) == parser_ok) {
        CHECK_ERROR(_readArrayU64(c, application->foreign_apps, &application->num_foreign_apps, MAX_FOREIGN_APPS))
        DISPLAY_APP_ITEM(IDX_FOREIGN_APP, application->num_foreign_apps, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_FOREIGN_ASSETS) == parser_ok) {
        CHECK_ERROR(_readArrayU64(c, application->foreign_assets, &application->num_foreign_assets, MAX_FOREIGN_ASSETS))
        DISPLAY_APP_ITEM(IDX_FOREIGN_ASSET, application->num_foreign_assets, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_ACCOUNTS) == parser_ok) {
        CHECK_ERROR(_verifyAccounts(c, &application->num_accounts, MAX_ACCT))
        DISPLAY_APP_ITEM(IDX_ACCOUNTS, application->num_accounts, tx_num_items, v)
    }

    if(application->num_accounts + application->num_foreign_apps + application->num_foreign_assets > ACCT_FOREIGN_LIMIT) {
        return parser_unexpected_number_items;
    }

    if (_findKey(c, KEY_APP_ARGS) == parser_ok) {
        CHECK_ERROR(_verifyAppArgs(c, application->app_args_len, &application->num_app_args, MAX_ARG))
        DISPLAY_APP_ITEM(IDX_APP_ARGS, application->num_app_args, tx_num_items, v)
    }

    uint16_t app_args_total_len = 0;
    for(uint8_t i = 0; i< application->num_app_args; i++) {
        app_args_total_len += application->app_args_len[i];
        if(app_args_total_len > MAX_ARGLEN) {
            return parser_unexpected_number_items;
        }
    }

    if (_findKey(c, KEY_APP_GLOBAL_SCHEMA) == parser_ok) {
        CHECK_ERROR(_readStateSchema(c, &application->global_schema))
        DISPLAY_APP_ITEM(IDX_GLOBAL_SCHEMA, 1, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_LOCAL_SCHEMA) == parser_ok) {
        CHECK_ERROR(_readStateSchema(c, &application->local_schema))
        DISPLAY_APP_ITEM(IDX_LOCAL_SCHEMA, 1, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_EXTRA_PAGES) == parser_ok) {
        CHECK_ERROR(_readUInt8(c, &application->extra_pages))
        if (application->extra_pages > 3){
            return parser_too_many_extra_pages;
        }
        DISPLAY_APP_ITEM(IDX_EXTRA_PAGES, 1, tx_num_items, v)
    }

    if (_findKey(c, KEY_APP_APROG_LEN) == parser_ok) {
        CHECK_ERROR(_getPointerBin(c, &application->aprog, &application->aprog_len))
        DISPLAY_APP_ITEM(IDX_APPROVE, 1, tx_num_items, v)
    }

   if (_findKey(c, KEY_APP_CPROG_LEN) == parser_ok) {
       CHECK_ERROR(_getPointerBin(c, &application->cprog, &application->cprog_len))
       DISPLAY_APP_ITEM(IDX_CLEAR, 1, tx_num_items, v)
   }

    if (application->id == 0 && application->cprog_len + application->aprog_len > PAGE_LEN *(1+application->extra_pages)){
        // ExtraPages needs to be checked only on application creation
        return parser_program_fields_too_long;
    }

    return parser_ok;
}

parser_error_t _read(parser_context_t *c, parser_tx_t *v)
{
    uint16_t keyLen = 0;
    CHECK_ERROR(initializeItemArray())

    CHECK_ERROR(_readMapSize(c, &keyLen))
    if(keyLen > UINT8_MAX) {
        return parser_unexpected_number_items;
    }

    // Read Tx type
    CHECK_ERROR(_readTxType(c, v))

    // Read common params
    CHECK_ERROR(_readTxCommonParams(c, v));

    // Read Tx specifics params
    switch (v->type) {
    case TX_PAYMENT:
        CHECK_ERROR(_readTxPayment(c, v))
        break;
    case TX_KEYREG:
        CHECK_ERROR(_readTxKeyreg(c, v))
        break;
    case TX_ASSET_XFER:
        CHECK_ERROR(_readTxAssetXfer(c, v))
        break;
    case TX_ASSET_FREEZE:
        CHECK_ERROR(_readTxAssetFreeze(c, v))
        break;
    case TX_ASSET_CONFIG:
        CHECK_ERROR(_readTxAssetConfig(c, v))
        break;
    case TX_APPLICATION:
        #if defined(TARGET_NANOS) || defined(TARGET_NANOS2) || defined(TARGET_NANOX) || defined(TARGET_STAX) || defined(TARGET_FLEX)
        CHECK_ERROR(_readTxApplication(c, v))
        if (!app_mode_blindsign()) {
            app_mode_skip_blindsign_ui();
        }
        #else
        CHECK_ERROR(_readTxApplication(c, v))
        #endif
        break;
    default:
        return parser_unknown_transaction;
        break;
    }

    num_items = common_num_items + tx_num_items + 1;
    return parser_ok;
}

#if !defined(TARGET_NANOS) && !defined(TARGET_NANOS2) && !defined(TARGET_NANOX) && !defined(TARGET_STAX) && !defined(TARGET_FLEX)
#include "crypto.h"
static parser_error_t _readSerializedHdPath(parser_context_t *c, parser_arbitrary_data_t *v)
{
    uint32_t serializedPathLen = sizeof(uint32_t) * HDPATH_LEN_DEFAULT;
    memcpy(hdPath, c->buffer, serializedPathLen);

    const bool mainnet = hdPath[0] == HDPATH_0_DEFAULT && hdPath[1] == HDPATH_1_DEFAULT;

    if (!mainnet) {
        return parser_failed_hd_path;
    }
    CTX_CHECK_AND_ADVANCE(c, serializedPathLen)
    return parser_ok;
}
#endif

parser_error_t _read_arbitrary_data(parser_context_t *c, parser_arbitrary_data_t *v)
{
    #if !defined(TARGET_NANOS) && !defined(TARGET_NANOS2) && !defined(TARGET_NANOX) && !defined(TARGET_STAX) && !defined(TARGET_FLEX)
    // For cpp_test, the path needs to be read here
    CHECK_ERROR(_readSerializedHdPath(c, v))
    #endif
    num_items++; // hdPath, read on process_chunk
    CHECK_ERROR(_readSigner(c, v))
    CHECK_ERROR(_readScope(c))
    CHECK_ERROR(_readEncoding(c))
    CHECK_ERROR(_readData(c, v))
    CHECK_ERROR(_readDomain(c, v))
    CHECK_ERROR(_readRequestId(c, v))
    CHECK_ERROR(_readAuthData(c, v))
    return parser_ok;
}

static parser_error_t _readSigner(parser_context_t *c, parser_arbitrary_data_t *v)
{
    v->signerBuffer = c->buffer + c->offset;

    
    #if defined(TARGET_NANOS) || defined(TARGET_NANOS2) || defined(TARGET_NANOX) || defined(TARGET_STAX) || defined(TARGET_FLEX)
    uint8_t raw_pubkey[PK_LEN_25519];
    zxerr_t err = crypto_extractPublicKey(raw_pubkey, PK_LEN_25519);
    if (err != zxerr_ok) {
        return parser_invalid_signer;
    }
    if (memcmp(raw_pubkey, v->signerBuffer, PK_LEN_25519) != 0) {
        return parser_invalid_signer;
    }
    #endif

    CTX_CHECK_AND_ADVANCE(c, PK_LEN_25519)

    num_items++;

    return parser_ok;
}

static parser_error_t _readScope(parser_context_t *c)
{
    uint8_t scope = 0;
    CHECK_ERROR(_readUInt8(c, &scope))
    
    if (scope != SCOPE_AUTH) {
        return parser_invalid_scope;
    }

    return parser_ok;
}

static parser_error_t _readEncoding(parser_context_t *c)
{
    uint8_t encoding = 0;
    CHECK_ERROR(_readUInt8(c, &encoding))
    
    if (encoding != ENCODING_BASE64) {
        return parser_invalid_encoding;
    }

    return parser_ok;
}

static parser_error_t _readData(parser_context_t *c, parser_arbitrary_data_t *v)
{
    uint32_t dataLen = 0;
    CHECK_ERROR(_readUInt32(c, &dataLen))
    v->dataLen = dataLen;
    v->dataBuffer = c->buffer + c->offset;

    // TODO : Check if data is a canonical JSON

    CHECK_ERROR(parser_json_parse((const char*)c->buffer + c->offset, dataLen, c, &num_json_items))
    num_items += num_json_items;

    return parser_ok;
}

static parser_error_t _readDomain(parser_context_t *c, parser_arbitrary_data_t *v)
{
    uint32_t domainLen = 0;
    CHECK_ERROR(_readUInt32(c, &domainLen))
    v->domainLen = domainLen;

    if (domainLen == 0) {
        return parser_missing_domain;
    }

    v->domainBuffer = c->buffer + c->offset;

    for (uint32_t i = 0; i < domainLen; i++) {
        // Check for representable ASCII (32-126)
        if (v->domainBuffer[i] < 32 || v->domainBuffer[i] > 126) {
            return parser_invalid_domain;
        }
    }

    CTX_CHECK_AND_ADVANCE(c, domainLen)

    num_items++;

    return parser_ok;
}

static parser_error_t _readRequestId(parser_context_t *c, parser_arbitrary_data_t *v)
{
    uint32_t requestIdLen = 0;
    CHECK_ERROR(_readUInt32(c, &requestIdLen))

    v->requestIdLen = requestIdLen;

    // RequestId is optional
    if (requestIdLen != 0) {
        v->requestIdBuffer = c->buffer + c->offset;
        // Check Uppercase Hex String
        for (uint32_t i = 0; i < requestIdLen; i++) {
            if (v->requestIdBuffer[i] < '0' || v->requestIdBuffer[i] > '9' ||
                v->requestIdBuffer[i] < 'A' || v->requestIdBuffer[i] > 'F') {
                return parser_invalid_request_id;
            }
        }
        CTX_CHECK_AND_ADVANCE(c, requestIdLen)
        num_items++;
    }

    return parser_ok;
}

static parser_error_t _readAuthData(parser_context_t *c, parser_arbitrary_data_t *v)
{
    uint32_t authDataLen = 0;
    CHECK_ERROR(_readUInt32(c, &authDataLen))
    v->authDataLen = authDataLen;

    if (authDataLen == 0) {
        return parser_missing_authenticated_data;
    }

    v->authDataBuffer = c->buffer + c->offset;

    CTX_CHECK_AND_ADVANCE(c, authDataLen)

    // authData first 32 bytes should be the sha256 of the domain
    uint8_t domainHash[PICOHASH_SHA256_DIGEST_LENGTH];
    picohash_ctx_t ctx;
    picohash_init_sha256(&ctx);
    picohash_update(&ctx, v->domainBuffer, v->domainLen);
    picohash_final(&ctx, domainHash);

    if (memcmp(domainHash, v->authDataBuffer, PICOHASH_SHA256_DIGEST_LENGTH) != 0) {
        return parser_failed_domain_auth;
    }

    num_items++;

    return parser_ok;
}

uint8_t _getNumItems()
{
    return num_items;
}

uint8_t _getCommonNumItems()
{
    return common_num_items;
}

uint8_t _getTxNumItems()
{
    return tx_num_items;
}

uint8_t _getNumJsonItems()
{
    return num_json_items;
}

uint16_t parser_mapParserErrorToSW(parser_error_t err) {
    switch (err) {
        case parser_invalid_scope:
            return APDU_CODE_INVALID_SCOPE;
        case parser_failed_decoding:
            return APDU_CODE_FAILED_DECODING;
        case parser_invalid_signer:
            return APDU_CODE_INVALID_SIGNER;
        case parser_missing_domain:
            return APDU_CODE_MISSING_DOMAIN;
        case parser_missing_authenticated_data:
            return APDU_CODE_MISSING_AUTHENTICATED_DATA;
        case parser_bad_json:
            return APDU_CODE_BAD_JSON;
        case parser_failed_domain_auth:
            return APDU_CODE_FAILED_DOMAIN_AUTH;
        case parser_failed_hd_path:
            return APDU_CODE_FAILED_HD_PATH;
        default:
            return APDU_CODE_DATA_INVALID;
    }
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
        case parser_unexpected_error:
            return "Unexpected error in parser";
        case parser_blindsign_mode_required:
            return "Blind signing mode required";
        case parser_unexpected_type:
            return "Unexpected type";
        case parser_unexpected_method:
            return "Unexpected method";
        case parser_unexpected_value:
            return "Unexpected value";
        case parser_unexpected_number_items:
            return "Unexpected number of items";
        case parser_invalid_address:
            return "Invalid address";
        case parser_program_fields_too_long:
            return "Clear/Apprv programs too long";
        case parser_too_many_extra_pages:
            return "Too many extra pages";
        case parser_buffer_too_small:
            return "Buffer too small";
        case parser_unknown_transaction:
            return "Unknown transaction";
        case parser_key_not_found:
            return "Key not found";
        case parser_msgpack_unexpected_type:
            return "Msgpack unexpected type";
        case parser_msgpack_unexpected_key:
            return "Msgpack unexpected key";
        case parser_msgpack_map_type_expected:
            return "Msgpack map tye expected";
        case parser_msgpack_map_type_not_supported:
            return "Msgpack map type not suported";
        case parser_msgpack_str_type_expected:
            return "Msgpack str type expected";
        case parser_msgpack_str_type_not_supported:
            return "Msgpack str type not supported";
        case parser_msgpack_str_too_big:
            return "Msgpack string too big";
        case parser_msgpack_bin_type_expected:
            return "msgpack_bin_type_expected";
        case parser_msgpack_bin_type_not_supported:
            return "msgpack_bin_type_not_supported";
        case parser_msgpack_bin_unexpected_size:
            return "msgpack_bin_unexpected_size";
        case parser_msgpack_int_type_expected:
            return "msgpack_int_type_expected";
        case parser_msgpack_bool_type_expected:
            return "msgpack_bool_type_expected";
        case parser_msgpack_array_unexpected_size:
            return "msgpack_array_unexpected_size";
        case parser_msgpack_array_too_big:
            return "msgpack_array_too_big";
        case parser_msgpack_array_type_expected:
            return "Msgpack array type expected";
        case parser_invalid_scope:
            return "Invalid Scope";
        case parser_failed_decoding:
            return "Failed decoding";
        case parser_invalid_signer:
            return "Invalid Signer";
        case parser_missing_domain:
            return "Missing Domain";
        case parser_invalid_domain:
            return "Invalid Domain";
        case parser_missing_authenticated_data:
            return "Missing Authentication Data";
        case parser_bad_json:
            return "Bad JSON";
        case parser_failed_domain_auth:
            return "Failed Domain Auth";
        case parser_failed_hd_path:
            return "Failed HD Path";
        case parser_invalid_request_id:
            return "Invalid Request ID";
        default:
            return "Unrecognized error code";
    }
}

const char *parser_getMsgPackTypeDescription(uint8_t type) {
    switch (type) {
        case FIXINT_0:
        case FIXINT_127:
            return "Fixed Integer";
        case FIXMAP_0:
        case FIXMAP_15:
            return "Fixed Map";
        case FIXARR_0:
        case FIXARR_15:
            return "Fixed Array";
        case FIXSTR_0:
        case FIXSTR_31:
            return "Fix String";
        case BOOL_FALSE:
        case BOOL_TRUE:
            return "Boolean";
        case BIN8:
        case BIN16:
        case BIN32:
            return "Binary";
        case UINT8:
        case UINT16:
        case UINT32:
        case UINT64:
            return "Integer";
        case STR8:
        case STR16:
        case STR32:
            return "String";
        case MAP16:
        case MAP32:
            return "Map";
        default:
            return "Unrecognized type";
    }
}

parser_error_t parser_jsonGetNthKey(parser_context_t *ctx, uint8_t displayIdx, char *outKey, uint16_t outKeyLen) {
    uint16_t token_index = 0;
    CHECK_ERROR(parser_json_object_get_nth_key(0, displayIdx, &token_index));
    CHECK_ERROR(parser_getJsonItemFromTokenIndex(ctx->parser_arbitrary_data_obj->dataBuffer, token_index, outKey, outKeyLen));
    return parser_ok;
}

parser_error_t parser_jsonGetNthValue(parser_context_t *ctx, uint8_t displayIdx, char *outVal, uint16_t outValLen) {
    uint16_t token_index = 0;
    CHECK_ERROR(parser_json_object_get_nth_value(0, displayIdx, &token_index));
    CHECK_ERROR(parser_getJsonItemFromTokenIndex(ctx->parser_arbitrary_data_obj->dataBuffer, token_index, outVal, outValLen));

    // Remove backslashes
    uint16_t removedBackslashes = 0;
    for (uint16_t i = 0; i < outValLen; i++) {
        if (outVal[i] == '\\') {
            memmove(&outVal[i], &outVal[i + 1], outValLen - i - 1);
            removedBackslashes++;
        }
        outValLen -= removedBackslashes;
        outVal[outValLen] = '\0';
    }

    return parser_ok;
}
