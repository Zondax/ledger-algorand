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

#include "cbor.h"
#include "parser_common.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct CborParser cbor_parser_t;
typedef struct CborValue cbor_value_t;

/**
 * Initializes a TinyCBOR parser
 *
 * @param[out] parser Pointer to a cbor_parser_t structure that will be initialized
 * @param[out] value Pointer to a cbor_value_t that will be initialized with the first element
 * @param[in] buffer Pointer to CBOR data to parse
 * @param[in] bufferSize Size of the CBOR data buffer
 * @return PARSER_CBOR_OK on success, PARSER_CBOR_ERROR_PARSER_INIT otherwise
 */
parser_error_t parser_init_cbor(
    cbor_parser_t *parser,
    cbor_value_t *value,
    const uint8_t *buffer,
    size_t bufferSize);

/**
 * Traverses all key-value pairs in a CBOR map and calls a callback function for each pair
 *
 * @param[in] map Pointer to a cbor_value_t that contains a CBOR map
 * @param[in] callback Function pointer to be called for each key-value pair
 * @param[in] context Optional user-provided context that will be passed to the callback
 * @return PARSER_CBOR_OK on success, error code otherwise
 */
parser_error_t parser_traverse_map_entries(
    cbor_value_t *map,
    parser_error_t (*callback)(cbor_value_t *key, cbor_value_t *value));

/**
 * Gets the size (number of key-value pairs) of a CBOR map
 *
 * @param[in] value Pointer to a cbor_value_t that contains a CBOR map
 * @param[out] mapSize Pointer to a size_t variable where the map size will be stored
 * @return PARSER_CBOR_OK on success, error code otherwise
 */
parser_error_t parser_get_map_size(
    cbor_value_t *value,
    size_t *mapSize);

/**
 * Enters a CBOR map container
 *
 * @param[in] value Pointer to a cbor_value_t that contains a CBOR map
 * @param[out] mapValue Pointer to a cbor_value_t that will be initialized with the map elements
 * @return PARSER_CBOR_OK on success, error code otherwise
 */
parser_error_t parser_enter_map(
    cbor_value_t *value,
    cbor_value_t *mapValue);

/**
 * Finds a specific value in a CBOR map by its key
 *
 * @param[in] map Pointer to a cbor_value_t that contains a CBOR map
 * @param[in] key C string containing the key to search for
 * @param[out] value Pointer to a cbor_value_t that will be initialized with the found value
 * @return PARSER_CBOR_OK on success, error code otherwise
 */
parser_error_t parser_find_map_value(
    const cbor_value_t *map,
    const char *key,
    cbor_value_t *value);

/**
 * Leaves a CBOR map container
 *
 * @param[in,out] map Pointer to the original cbor_value_t before entering the map
 * @param[in] mapValue Pointer to the cbor_value_t after all map elements have been processed
 * @return PARSER_CBOR_OK on success, error code otherwise
 */
parser_error_t parser_leave_map(
    cbor_value_t *map,
    const cbor_value_t *mapValue);

/**
 * Reads an array of integers from a CBOR array
 *
 * @param[in] value Pointer to a cbor_value_t that contains a CBOR array
 * @param[out] values Pointer to an integer array where the values will be stored
 * @param[out] count Pointer to a size_t variable where the number of values will be stored
 * @return parser_ok on success, error code otherwise
 */
parser_error_t read_int_array(
    cbor_value_t *value,
    int *values,
    size_t *count);

#ifdef __cplusplus
}
#endif