/*******************************************************************************
*   (c) 2019 Zondax GmbH
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

#include <stdio.h>
#include <zxmacros.h>
#include <zxformat.h>
#include <zxtypes.h>

#include "coin.h"
// #include "tx_parser.h"
// #include "tx_display.h"
#include "parser_common.h"
#include "parser_impl.h"
#include "parser.h"

parser_error_t parser_parse(parser_context_t *ctx,
                            const uint8_t *data,
                            size_t dataLen,
                            parser_tx_t *tx_obj) {
    CHECK_ERROR(parser_init(ctx, data, dataLen))
    ctx->parser_tx_obj = tx_obj;
    return _read(ctx, tx_obj);
}

parser_error_t parser_validate(const parser_context_t *ctx) {
    // CHECK_PARSER_ERR(tx_validate(&parser_tx_obj.json))

#if 0
    // Iterate through all items to check that all can be shown and are valid
    uint8_t numItems = 0;
    CHECK_PARSER_ERR(parser_getNumItems(ctx, &numItems))

    char tmpKey[40];
    char tmpVal[40];

    for (uint8_t idx = 0; idx < numItems; idx++) {
        uint8_t pageCount = 0;
        CHECK_PARSER_ERR(parser_getItem(ctx, idx, tmpKey, sizeof(tmpKey), tmpVal, sizeof(tmpVal), 0, &pageCount))
    }
#endif
    return parser_ok;
}

parser_error_t parser_getNumItems(const parser_context_t *ctx, uint8_t *num_items) {
    *num_items = _getNumItems();
    if(*num_items == 0) {
        return parser_unexpected_number_items;
    }
    return parser_ok;
}

parser_error_t parser_getCommonNumItems(const parser_context_t *ctx, uint8_t *common_num_items) {
    *common_num_items = _getCommonNumItems();
    if(*common_num_items == 0) {
        return parser_unexpected_number_items;
    }
    return parser_ok;
}

parser_error_t parser_getTxNumItems(const parser_context_t *ctx, uint8_t *tx_num_items) {
    *tx_num_items = _getTxNumItems();
    if(*tx_num_items == 0) {
        return parser_unexpected_number_items;
    }
    return parser_ok;
}

static void cleanOutput(char *outKey, uint16_t outKeyLen,
                        char *outVal, uint16_t outValLen)
{
    MEMZERO(outKey, outKeyLen);
    MEMZERO(outVal, outValLen);
    snprintf(outKey, outKeyLen, "?");
    snprintf(outVal, outValLen, " ");
}

__Z_INLINE parser_error_t checkSanity(uint8_t numItems, uint8_t displayIdx)
{
    if ( displayIdx >= numItems) {
        return parser_display_idx_out_of_range;
    }
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printTxType(const parser_context_t *ctx, char *outKey, uint16_t outKeyLen, char *outVal, uint16_t outValLen, uint8_t *pageCount)
{
    *pageCount = 1;
    snprintf(outKey, outKeyLen, "Tx type ");

    switch (ctx->parser_tx_obj->type) {
        case TX_PAYMENT:
            snprintf(outVal, outValLen, "Payment");
            break;
        case TX_KEYREG:
            snprintf(outVal, outValLen, "Key Registration");
            break;
        case TX_ASSET_XFER:
            snprintf(outVal, outValLen, "Asset Transfer");
            break;
        case TX_ASSET_FREEZE:
            snprintf(outVal, outValLen, "Asset Freeze");
            break;
        case TX_ASSET_CONFIG:
            snprintf(outVal, outValLen, "Asset Config");
            break;
        case TX_APPLICATION:
            snprintf(outVal, outValLen, "Application");
            break;
        default:
            return parser_unexpected_error;
    }
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printCommonParams(const parser_context_t *ctx,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0:
            snprintf(outKey, outKeyLen, "Fee");
            if (int64_to_str(outVal, outValLen, ctx->parser_tx_obj->fee) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 1:
            snprintf(outKey, outKeyLen, "First valid");
            if (int64_to_str(outVal, outValLen, ctx->parser_tx_obj->firstValid) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 2:
            snprintf(outKey, outKeyLen, "Genesis hash");
            pageString(outVal, outValLen, (char*) ctx->parser_tx_obj->genesisHash, pageIdx, pageCount);
            return parser_ok;
            break;

        case 3:
            snprintf(outKey, outKeyLen, "Last valid");
            if (int64_to_str(outVal, outValLen, ctx->parser_tx_obj->lastValid) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 4:
            snprintf(outKey, outKeyLen, "Sender");
            pageString(outVal, outValLen, (char*) ctx->parser_tx_obj->sender, pageIdx, pageCount);
            return parser_ok;
            break;

    default:
        snprintf(outKey, outKeyLen, "Default");
        snprintf(outVal, outValLen, "Fill this");
        return parser_ok;
        break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxPayment(const txn_payment *payment,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printTxKeyreg(const txn_keyreg *keyreg,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printTxAssetXfer(const txn_asset_xfer *asset_xfer,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printTxAssetFreeze(const txn_asset_freeze *asset_freeze,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0:
            snprintf(outKey, outKeyLen, "Freeze Account");
            snprintf(outVal, outValLen, "PrintAccount");
            return parser_ok;
            break;

        case 1:
            snprintf(outKey, outKeyLen, "Freeze Asset");
            if (uint64_to_str(outVal, outValLen, asset_freeze->id) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 2:
            snprintf(outKey, outKeyLen, "Asset Frozen");
            if (asset_freeze->flag) {
                snprintf(outVal, outValLen, "True");
            } else {
                snprintf(outVal, outValLen, "False");
            }
            return parser_ok;
            break;

        default:
            break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxAssetConfig(const txn_asset_config *asset_config,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    return parser_ok;
}

__Z_INLINE parser_error_t parser_printTxApplication(const txn_application *application,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    return parser_ok;
}


parser_error_t parser_getItem(const parser_context_t *ctx,
                              uint8_t displayIdx,
                              char *outKey, uint16_t outKeyLen,
                              char *outVal, uint16_t outValLen,
                              uint8_t pageIdx, uint8_t *pageCount) {
    cleanOutput(outKey, outKeyLen, outVal, outValLen);
    *pageCount = 0;

    uint8_t numItems = 0;
    CHECK_ERROR(parser_getNumItems(ctx, &numItems))
    CHECK_APP_CANARY()

    uint8_t commonItems = 0;
    CHECK_ERROR(parser_getCommonNumItems(ctx, &commonItems))

    uint8_t txItems = 0;
    CHECK_ERROR(parser_getTxNumItems(ctx, &txItems))

    CHECK_ERROR(checkSanity(numItems, displayIdx))


    if (displayIdx == 0) {
        return parser_printTxType(ctx, outKey, outKeyLen, outVal, outValLen, pageCount);
    }

    if (displayIdx <= commonItems) {
        return parser_printCommonParams(ctx, displayIdx - 1, outKey, outKeyLen,
                                        outVal, outValLen, pageIdx, pageCount);
    }

    displayIdx = displayIdx - commonItems -1;
    if (displayIdx < txItems) {
        switch (ctx->parser_tx_obj->type) {
            case TX_PAYMENT:
                return parser_printTxPayment(&ctx->parser_tx_obj->payment,
                                             displayIdx, outKey, outKeyLen,
                                             outVal, outValLen, pageIdx, pageCount);
                break;
            case TX_KEYREG:
                return parser_printTxKeyreg(&ctx->parser_tx_obj->keyreg,
                                            displayIdx, outKey, outKeyLen,
                                            outVal, outValLen, pageIdx, pageCount);
                break;
            case TX_ASSET_XFER:
                return parser_printTxAssetXfer(&ctx->parser_tx_obj->asset_xfer,
                                               displayIdx, outKey, outKeyLen,
                                               outVal, outValLen, pageIdx, pageCount);
                break;
            case TX_ASSET_FREEZE:
                return parser_printTxAssetFreeze(&ctx->parser_tx_obj->asset_freeze,
                                                 displayIdx, outKey, outKeyLen,
                                                 outVal, outValLen, pageIdx, pageCount);
                break;
            case TX_ASSET_CONFIG:
                return parser_printTxAssetConfig(&ctx->parser_tx_obj->asset_config,
                                                 displayIdx, outKey, outKeyLen,
                                                 outVal, outValLen, pageIdx, pageCount);
                break;
            case TX_APPLICATION:
                return parser_printTxApplication(&ctx->parser_tx_obj->application,
                                                 displayIdx, outKey, outKeyLen,
                                                 outVal, outValLen, pageIdx, pageCount);
                break;
            default:
                return parser_unexpected_error;
        }
        return parser_display_idx_out_of_range;
    }

    return parser_display_idx_out_of_range;
}
