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
    zemu_log("parser_getNumItems\n");
    *num_items = _getNumItems();
    if(*num_items == 0) {
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

    CHECK_ERROR(checkSanity(numItems, displayIdx))

    if (displayIdx == 0) {
        snprintf(outKey, outKeyLen, "Tx type ");
        return parser_ok;
        // return _printAddress(&parser_tx_obj.to,
        //                      outVal, outValLen, pageIdx, pageCount);
    }

    switch (parser_tx_obj.type)
    {
    case TX_PAYMENT:
        /* code */
        break;
    case TX_KEYREG:
        /* code */
        break;
    case TX_ASSET_XFER:
        /* code */
        break;
    case TX_ASSET_FREEZE:
        /* code */
        break;
    case TX_ASSET_CONFIG:
        /* code */
        break;
    case TX_APPLICATION:
        /* code */
        break;
    default:
        return parser_unexpected_error;
    }


    return parser_ok;
}
