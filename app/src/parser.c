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

#include "base64.h"
#include "algo_addr.h"
#include "str.h"
#include "algo_asa.h"

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

// //////////////////////////////////////////////////////////////////////////////////////////////////////
// Helpers
__Z_INLINE bool is_opt_in_tx(parser_tx_t *tx_obj) {

    if(tx_obj->type == TX_ASSET_XFER && tx_obj->asset_xfer.amount == 0 && tx_obj->asset_xfer.id != 0 &&
        memcmp(tx_obj->asset_xfer.receiver, tx_obj->asset_xfer.sender, sizeof(tx_obj->asset_xfer.receiver)) == 0)
    {
            return true;
    }
    return false;
}

__Z_INLINE bool all_zero_key(uint8_t *buff) {
  for (int i = 0; i < 32; i++) {
    if (buff[i] != 0) {
      return false;
    }
  }
  return true;
}

__Z_INLINE parser_error_t b64hash_data(unsigned char *data, size_t data_len, char *b64hash, size_t b64hashLen) {
    // static char b64hash[45];
    unsigned char hash[32];

    // Hash program and b64 encode for display
    cx_sha256_t ctx;
    memset(&ctx, 0, sizeof(ctx));
    cx_sha256_init(&ctx);
    cx_hash(&ctx.header, CX_LAST, data, data_len, hash, sizeof(hash));
    base64_encode((const char *)hash, sizeof(hash), b64hash, b64hashLen);

    // return b64hash;
    return parser_ok;
}

__Z_INLINE parser_error_t _toStringBalance(uint64_t* amount, uint8_t decimalPlaces, char postfix[], char prefix[],
                                char* outValue, uint16_t outValueLen, uint8_t pageIdx, uint8_t* pageCount)
{
    char bufferUI[200] = {0};
    if (uint64_to_str(bufferUI, sizeof(bufferUI), *amount) != NULL) {
        return parser_unexpected_value;
    }

    if (intstr_to_fpstr_inplace(bufferUI, sizeof(bufferUI), decimalPlaces) == 0) {
        return parser_unexpected_value;
    }

    if (z_str3join(bufferUI, sizeof(bufferUI), prefix, postfix) != zxerr_ok) {
        return parser_unexpected_buffer_end;
    }

    pageString(outValue, outValueLen, bufferUI, pageIdx, pageCount);
    return parser_ok;
}

__Z_INLINE parser_error_t _toStringAddress(uint8_t* address, char* outValue, uint16_t outValueLen, uint8_t pageIdx, uint8_t* pageCount)
{
    if (all_zero_key(address)) {
        snprintf(outValue, outValueLen, "Zero");
        *pageCount = 1;
    } else {
        char buff[65] = {0};
        convert_to_public_address(address, (unsigned char*)buff);
        pageString(outValue, outValueLen, buff, pageIdx, pageCount);
    }
    return parser_ok;
}

__Z_INLINE parser_error_t _toStringSchema(const state_schema *schema, char* outValue, uint16_t outValueLen, uint8_t pageIdx, uint8_t* pageCount)
{
    // Don't display if nonzero schema cannot be valid
    // if (current_txn.application.id != 0) {
    //     return 0;
    // }
    char schm_repr[65] = {0};
    char uint_part[32] = {0};
    char byte_part[32] = {0};
    snprintf(uint_part, sizeof(uint_part), "uint: %s", u64str(schema->num_uint));
    snprintf(byte_part, sizeof(byte_part), "byte: %s", u64str(schema->num_byteslice));
    snprintf(schm_repr, sizeof(schm_repr), "%s, %s",   uint_part, byte_part);
    pageString(outValue, outValueLen, schm_repr, pageIdx, pageCount);

    return parser_ok;
}

// //////////////////////////////////////////////////////////////////////////////////////////////////////
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
    snprintf(outKey, outKeyLen, "Tx type");

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

__Z_INLINE parser_error_t parser_printCommonParams(const parser_tx_t *parser_tx_obj,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0:
            snprintf(outKey, outKeyLen, "Fee");
            return _toStringBalance((uint64_t*) &parser_tx_obj->fee, COIN_AMOUNT_DECIMAL_PLACES, "", "",
                                    outVal, outValLen, pageIdx, pageCount);
            break;

        case 1:
            snprintf(outKey, outKeyLen, "First valid");
            if (int64_to_str(outVal, outValLen, parser_tx_obj->firstValid) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 2: {
            snprintf(outKey, outKeyLen, "Genesis hash");
            // Should we hide this field when genID is default/empty and genHash == genHash default? Check ui_txn.c
            char buff[45];
            base64_encode((const char*) parser_tx_obj->genesisHash, sizeof(parser_tx_obj->genesisHash), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 3:
            snprintf(outKey, outKeyLen, "Last valid");
            if (int64_to_str(outVal, outValLen, parser_tx_obj->lastValid) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;

        case 4: {
            snprintf(outKey, outKeyLen, "Sender");
            char buff[65] = {0};
            convert_to_public_address(parser_tx_obj->sender, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 10: {
            snprintf(outKey, outKeyLen, "Group ID");
            //Check all zero?
            char buff[45];
            base64_encode((const char*) parser_tx_obj->groupID, sizeof(parser_tx_obj->groupID), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 11: {
            snprintf(outKey, outKeyLen, "Rekey to");
            char buff[65] = {0};
            convert_to_public_address(parser_tx_obj->rekey, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 12: {
            snprintf(outKey, outKeyLen, "Note");
            snprintf(outVal, outValLen, "%d bytes", parser_tx_obj->note_len);
            return parser_ok;
            break;
        }

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
    *pageCount = 1;
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "Receiver");
            char buff[65] = {0};
            convert_to_public_address(payment->receiver, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 1:
            snprintf(outKey, outKeyLen, "Amount");
            return _toStringBalance((uint64_t*) &payment->amount, COIN_AMOUNT_DECIMAL_PLACES, "", "",
                                    outVal, outValLen, pageIdx, pageCount);
            break;

        case 2: {
            snprintf(outKey, outKeyLen, "Close to");
            char buff[65] = {0};
            convert_to_public_address(payment->close, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        default:
            break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxKeyreg(const txn_keyreg *keyreg,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "Vote PK");
            char buff[45];
            base64_encode((const char*) keyreg->votepk, sizeof(keyreg->votepk), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 1: {
            snprintf(outKey, outKeyLen, "VRF PK");
            char buff[45];
            base64_encode((const char*) keyreg->vrfpk, sizeof(keyreg->vrfpk), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 2: {
            snprintf(outKey, outKeyLen, "Stateproof PK");
            char buff[90];
            base64_encode((const char*) keyreg->sprfkey, sizeof(keyreg->sprfkey), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
            break;
        }

        case 3: {
            snprintf(outKey, outKeyLen, "Vote first");
            if (int64_to_str(outVal, outValLen, keyreg->voteFirst) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;
        }

        case 4: {
            snprintf(outKey, outKeyLen, "Vote last");
            if (int64_to_str(outVal, outValLen, keyreg->voteLast) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;
        }

        case 5: {
            snprintf(outKey, outKeyLen, "Key dilution");
            if (int64_to_str(outVal, outValLen, keyreg->keyDilution) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
            break;
        }

        case 6: {
            snprintf(outKey, outKeyLen, "Participating");
            if (keyreg->nonpartFlag) {
                snprintf(outVal, outValLen, "No");
            } else {
                snprintf(outVal, outValLen, "Yes");
            }
            return parser_ok;
            break;
        }

        default:
            break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxAssetXfer(const txn_asset_xfer *asset_xfer,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "Asset ID");
            const algo_asset_info_t *asa = algo_asa_get(asset_xfer->id);
            const char *id = u64str(asset_xfer->id);
            if (asa == NULL) {
                snprintf(outVal, outValLen, "#%s", id);
            } else {
                snprintf(outVal, outValLen, "%s (#%s)", asa->name, id);
            }
            return parser_ok;
        }

        case 1: {
            //Hide if is_opt_in_tx
            // if(is_opt_in_tx()){
            //     return 0;
            // }
            const algo_asset_info_t *asa = algo_asa_get(asset_xfer->id);
            //Want to add token symbol here?
            if (asa == NULL) {
                //No decimals here????
                snprintf(outKey, outKeyLen, "Amount (base unit)");
                return _toStringBalance((uint64_t*) &asset_xfer->amount, 0, "", "",
                                        outVal, outValLen, pageIdx, pageCount);
            } else {
                snprintf(outKey, outKeyLen, "Amount (%s)", asa->unit);
                return _toStringBalance((uint64_t*) &asset_xfer->amount, asa->decimals, "", "",
                                        outVal, outValLen, pageIdx, pageCount);
            }
        }

        case 2: {
            snprintf(outKey, outKeyLen, "Asset src");
            char buff[65] = {0};
            convert_to_public_address(asset_xfer->sender, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 3: {
            snprintf(outKey, outKeyLen, "Asset dst");
            //If is_opt_in_tx --> don't display
            char buff[65] = {0};
            convert_to_public_address(asset_xfer->receiver, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 4: {
            snprintf(outKey, outKeyLen, "Asset close");
            char buff[65] = {0};
            convert_to_public_address(asset_xfer->close, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        default:
            break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxAssetFreeze(const txn_asset_freeze *asset_freeze,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "Asset account");
            char buff[65] = {0};
            convert_to_public_address(asset_freeze->account, (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 1:
            snprintf(outKey, outKeyLen, "Asset ID");
            if (uint64_to_str(outVal, outValLen, asset_freeze->id) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;

        case 2:
            snprintf(outKey, outKeyLen, "Freeze flag");
            if (asset_freeze->flag) {
                snprintf(outVal, outValLen, "Frozen");
            } else {
                snprintf(outVal, outValLen, "Unfrozen");
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
    *pageCount = 1;
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "Asset ID");
            if (asset_config->id == 0) {
                snprintf(outKey, outKeyLen, "Create");
            } else {
                if (uint64_to_str(outVal, outValLen, asset_config->id) != NULL) {
                    return parser_unexpected_error;
                }
            }
            return parser_ok;
        }

        case 1: {
            snprintf(outKey, outKeyLen, "Total units");
            //Don't display if id != 0 && params.total == 0
            if (uint64_to_str(outVal, outValLen, asset_config->params.total) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
        }

        case 2: {
            snprintf(outKey, outKeyLen, "Default frozen");
            //Don't display if id != 0 && params.default_frozen == 0
            if (asset_config->params.default_frozen) {
                snprintf(outVal, outValLen, "Frozen");
            } else {
                snprintf(outVal, outValLen, "Unfrozen");
            }
            return parser_ok;
            break;
        }

        case 3: {
            snprintf(outKey, outKeyLen, "Unit name");
            snprintf(outVal, outValLen, "%s", asset_config->params.unitname);
            return parser_ok;
        }

        case 4: {
            snprintf(outKey, outKeyLen, "Decimals");
            if (uint64_to_str(outVal, outValLen, asset_config->params.decimals) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
        }

        case 5: {
            snprintf(outKey, outKeyLen, "Asset name");
            snprintf(outVal, outValLen, "%s", asset_config->params.assetname);
            return parser_ok;
        }

        case 6: {
            snprintf(outKey, outKeyLen, "URL");
            snprintf(outVal, outValLen, "%s", asset_config->params.url);
            return parser_ok;
        }

        case 7: {
            snprintf(outKey, outKeyLen, "Metadata hash");
            char buff[45];
            base64_encode((const char*) asset_config->params.metadata_hash, sizeof(asset_config->params.metadata_hash), buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 8: {
            snprintf(outKey, outKeyLen, "Manager");
            return _toStringAddress((uint8_t*) asset_config->params.manager, outVal, outValLen, pageIdx, pageCount);
        }

        case 9: {
            snprintf(outKey, outKeyLen, "Reserve");
            return _toStringAddress((uint8_t*) asset_config->params.reserve, outVal, outValLen, pageIdx, pageCount);
        }

        case 10: {
            snprintf(outKey, outKeyLen, "Freezer");
            return _toStringAddress((uint8_t*) asset_config->params.freeze, outVal, outValLen, pageIdx, pageCount);
        }

        case 11: {
            snprintf(outKey, outKeyLen, "Clawback");
            return _toStringAddress((uint8_t*) asset_config->params.clawback, outVal, outValLen, pageIdx, pageCount);
        }

        default:
            break;
    }

    return parser_display_idx_out_of_range;
}

__Z_INLINE parser_error_t parser_printTxApplication(const txn_application *application,
                                                   uint8_t displayIdx,
                                                   char *outKey, uint16_t outKeyLen,
                                                   char *outVal, uint16_t outValLen,
                                                   uint8_t pageIdx, uint8_t *pageCount)
{
    *pageCount = 1;
    switch (displayIdx) {
        case 0: {
            snprintf(outKey, outKeyLen, "App ID");
            if (uint64_to_str(outVal, outValLen, application->id) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
        }

        case 1: {
            snprintf(outKey, outKeyLen, "On completion");
            switch (application->oncompletion)
            {
            case NOOPOC:
                snprintf(outVal, outValLen, "NoOp");
                break;
            case OPTINOC:
                snprintf(outVal, outValLen, "OptIn");
                break;
            case CLOSEOUTOC:
                snprintf(outVal, outValLen, "CloseOut");
                break;
            case CLEARSTATEOC:
                snprintf(outVal, outValLen, "ClearState");
                break;
            case UPDATEAPPOC:
                snprintf(outVal, outValLen, "UpdateApp");
                break;
            case DELETEAPPOC:
                snprintf(outVal, outValLen, "DeleteApp");
                break;
            default:
                snprintf(outVal, outValLen, "Unknown");
                break;
            }
            return parser_ok;
        }

        case 2: {
            snprintf(outKey, outKeyLen, "Foreign app 0");
            //check that foreign_apps size >= 1
            if (uint64_to_str(outVal, outValLen, application->foreign_apps[0]) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
        }

        case 3: {
            snprintf(outKey, outKeyLen, "Foreign asset 0");
            //check that foreign_assets size >= 1
            if (uint64_to_str(outVal, outValLen, application->foreign_assets[0]) != NULL) {
                return parser_unexpected_error;
            }
            return parser_ok;
        }

        case 4:
        case 5: {
            snprintf(outKey, outKeyLen, "App account %d", (displayIdx - 4));
            char buff[65] = {0};
            convert_to_public_address(application->accounts[displayIdx - 4], (unsigned char*)buff);
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 6:
        case 7: {
            snprintf(outKey, outKeyLen, "App arg %d (sha256)", (displayIdx - 6));
            //check that num_app_args >= 1 or 2
            char buff[45] = {0};
            b64hash_data((unsigned char*) application->app_args[displayIdx - 6], application->app_args_len[displayIdx - 6], buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 8: {
            snprintf(outKey, outKeyLen, "Global schema");
            return _toStringSchema(&application->global_schema, outVal, outValLen, pageIdx, pageCount);
        }

        case 9: {
            snprintf(outKey, outKeyLen, "Local schema");
            return _toStringSchema(&application->local_schema, outVal, outValLen, pageIdx, pageCount);
        }

        case 10: {
            snprintf(outKey, outKeyLen, "Apprv (sha256)");
            char buff[45] = {0};
            b64hash_data((unsigned char*) application->aprog, application->aprog_len, buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        case 11: {
            snprintf(outKey, outKeyLen, "Clear (sha256)");
            char buff[45] = {0};
            b64hash_data((unsigned char*) application->cprog, application->cprog_len, buff, sizeof(buff));
            pageString(outVal, outValLen, buff, pageIdx, pageCount);
            return parser_ok;
        }

        default:
            break;
    }

    return parser_display_idx_out_of_range;
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
        return parser_printCommonParams(ctx->parser_tx_obj, displayIdx - 1, outKey, outKeyLen,
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
