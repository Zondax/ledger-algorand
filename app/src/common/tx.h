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

#include "os.h"
#include "coin.h"
#include "zxerror.h"
#include "parser_txdef.h"
#include "parser_common.h"
void tx_initialize();

/// Clears the transaction buffer
void tx_reset();

/// Appends buffer to the end of the current transaction buffer
/// Transaction buffer will grow until it reaches the maximum allowed size
/// \param buffer
/// \param length
/// \return It returns an error message if the buffer is too small.
uint32_t tx_append(unsigned char *buffer, uint32_t length);

/// Returns size of the raw json transaction buffer
/// \return
uint32_t tx_get_buffer_length();

/// Returns the raw json transaction buffer
/// \return
uint8_t *tx_get_buffer();

/// Returns the parser context
/// \return
parser_context_t *tx_get_parser_context();

/// Parse message stored in transaction buffer
/// This function should be called as soon as full buffer data is loaded.
/// \return It returns NULL if data is valid or error message otherwise.
parser_error_t tx_parse(txn_content_e content);

/// Return the number of items in the transaction
zxerr_t tx_getNumItems(uint8_t *num_items);

/// Gets an specific item from the transaction (including paging)
zxerr_t tx_getItem(int8_t displayIdx,
                   char *outKey, uint16_t outKeyLen,
                   char *outValue, uint16_t outValueLen,
                   uint8_t pageIdx, uint8_t *pageCount);
