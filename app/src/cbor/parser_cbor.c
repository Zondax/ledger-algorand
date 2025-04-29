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

#include "cbor.h"
#include "parser_cbor.h"
#include "parser_common.h"

parser_error_t parser_init_cbor(
    cbor_parser_t *parser,
    cbor_value_t *value,
    const uint8_t *buffer,
    size_t bufferSize) {
    
    CborError err = cbor_parser_init(buffer, bufferSize, 0, parser, value);
    
    if (err != CborNoError) {
        return parser_cbor_error_parser_init;
    }
    
    return parser_ok;
}

parser_error_t parser_traverse_map_entries(
    cbor_value_t *map,
    parser_error_t (*callback)(cbor_value_t *key, cbor_value_t *value)) {
    
    if (!cbor_value_is_map(map)) {
        return parser_cbor_error_invalid_type;
    }
    
    cbor_value_t mapCopy;
    parser_error_t err = parser_enter_map(map, &mapCopy);
    
    if (err != parser_ok) {
        return err;
    }
    
    while (!cbor_value_at_end(&mapCopy)) {
        cbor_value_t key = mapCopy;
        
        // Advance to the value
        CborError cborErr = cbor_value_advance(&mapCopy);
        if (cborErr != CborNoError) {
            return parser_cbor_error_unexpected;
        }
        
        cbor_value_t value = mapCopy;
        
        // Call the callback with the key-value pair
        parser_error_t callbackResult = callback(&key, &value);
        if (callbackResult != parser_ok) {
            return callbackResult;
        }
        
        // Advance to the next key
        cborErr = cbor_value_advance(&mapCopy);
        if (cborErr != CborNoError) {
            return parser_cbor_error_unexpected;
        }
    }
    
    // Leave the container
    return parser_leave_map(map, &mapCopy);
}


parser_error_t parser_enter_map(
    cbor_value_t *value,
    cbor_value_t *mapValue) {
    
    if (!cbor_value_is_map(value)) {
        return parser_cbor_error_invalid_type;
    }
    
    CborError err = cbor_value_enter_container(value, mapValue);
    
    if (err != CborNoError) {
        return parser_cbor_error_map_entry;
    }
    
    return parser_ok;
}

parser_error_t parser_leave_map(
    cbor_value_t *map,
    const cbor_value_t *mapValue) {
    
    CborError err = cbor_value_leave_container(map, mapValue);
    
    if (err != CborNoError) {
        return parser_cbor_error_map_entry;
    }
    
    return parser_ok;
}

parser_error_t read_int_array(cbor_value_t *value, int *values, size_t *count) {
    cbor_value_t element;
    size_t i = 0;
    size_t max_items = 0;

    if (cbor_value_get_array_length(value, &max_items) != CborNoError) {
        return parser_cbor_error_unexpected;
    }

    // Verify it's an array
    if (!cbor_value_is_array(value))
        return parser_cbor_error_invalid_type;
        
    // Get array length if known
    size_t array_length;
    if (cbor_value_is_length_known(value)) {
        if (cbor_value_get_array_length(value, &array_length) != CborNoError)
            return parser_cbor_error_unexpected;
        if (array_length > max_items)
            return parser_cbor_error_out_of_memory;
    }
    
    // Enter the array container
    if (cbor_value_enter_container(value, &element) != CborNoError)
        return parser_cbor_error_container;
    
    // Iterate through array elements
    while (!cbor_value_at_end(&element) && i < max_items) {
        // Make sure we're looking at an integer
        if (!cbor_value_is_integer(&element))
            return parser_cbor_error_invalid_type;
            
        // Get the integer value
        if (cbor_value_get_int(&element, &values[i]) != CborNoError)
            return parser_cbor_error_unexpected;
            
        // Move to next element
        if (cbor_value_advance(&element) != CborNoError)
            return parser_cbor_error_unexpected;
            
        i++;
    }
    
    // Leave the array container
    if (cbor_value_leave_container(value, &element) != CborNoError)
        return parser_cbor_error_container;
    
    *count = i;
    return parser_ok;
}
