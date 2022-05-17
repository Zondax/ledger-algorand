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

#include "gmock/gmock.h"

#include <vector>
#include <iostream>
#include <hexutils.h>
#include <parser_txdef.h>
#include <parser.h>
#include "parser_impl.h"

using namespace std;

TEST(SCALE, ReadBytes) {
    parser_context_t ctx;
    parser_error_t err;
    uint8_t buffer[100];
    auto bufferLen = parseHexString(
            buffer,
            sizeof(buffer),
            "45"
            "123456"
            "12345678901234567890"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint8_t bytesArray[100] = {0};
    err = _readBytes(&ctx, bytesArray, 1);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(bytesArray[0], 0x45);

    uint8_t testArray[3] = {0x12, 0x34, 0x56};
    err = _readBytes(&ctx, bytesArray+1, 3);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    for (uint8_t i = 0; i < 3; i++) {
        EXPECT_EQ(testArray[i], bytesArray[i+1]);
    }

    uint8_t testArray2[10] = {0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90};
    err = _readBytes(&ctx, bytesArray+4, 10);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    for (uint8_t i = 0; i < 10; i++) {
        EXPECT_EQ(testArray2[i], bytesArray[i+4]);
    }
}

TEST(SCALE, ReadBytesFailed) {
    parser_context_t ctx;
    parser_error_t err;
    uint8_t buffer[100];
    auto bufferLen = parseHexString(
            buffer,
            sizeof(buffer),
            "45"
            "123456"
            "12345678901234567890"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint8_t bytesArray[5] = {0};
    err = _readBytes(&ctx, bytesArray, 50);
    EXPECT_EQ(err, parser_unexpected_buffer_end) << parser_getErrorDescription(err);
}

TEST(SCALE, EncodingUint8) {
    parser_context_t ctx;
    parser_error_t err;
    uint8_t buffer[100] = {130, 169, 102, 105, 120, 101, 100, 85, 105, 110, 116, 12, 165, 117, 105, 110, 116, 56, 204, 230};
    auto bufferLen {50};

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[32] = {0};
    uint64_t value {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "fixedUint"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 12);


    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint8"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 230);
}

TEST(SCALE, EncodingUint16) {
    parser_context_t ctx;
    parser_error_t err;

    uint8_t buffer[100];
    auto bufferLen = parseHexString(
        buffer,
        sizeof(buffer),
        "82A875696E7431365F30CD3039A875696E7431365F31CDFE08"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[32] = {0};
    uint64_t value {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint16_0"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 12345);

    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint16_1"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 65032);
}

TEST(SCALE, EncodingUint32) {
    parser_context_t ctx;
    parser_error_t err;

    uint8_t buffer[100];
    auto bufferLen = parseHexString(
        buffer,
        sizeof(buffer),
        "82A875696E7433325F30CE00BC6079A875696E7433325F31CE19999999"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[32] = {0};
    uint64_t value {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint32_0"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 12345465);

    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint32_1"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 429496729);
}

TEST(SCALE, EncodingUint64) {
    parser_context_t ctx;
    parser_error_t err;

    uint8_t buffer[100];
    auto bufferLen = parseHexString(
        buffer,
        sizeof(buffer),
        "82A875696E7436345F30CF0000000000BC6079A875696E7436345F31CF000000000054D6B4"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[32] = {0};
    uint64_t value {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint64_0"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 12345465);

    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "uint64_1"), 0);

    err = _readInteger(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 5559988);
}

TEST(SCALE, EncodingString) {
    parser_context_t ctx;
    parser_error_t err;

    uint8_t buffer[100];
    auto bufferLen = parseHexString(
        buffer,
        sizeof(buffer),
        "82A8737472696E675F30AA6E657720737472696E67A8737472696E675F31D921736F6D65207465787420686572652074686174206D69676874206265206C6F6E67"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[50] = {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "string_0"), 0);

    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "new string"), 0);

    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "string_1"), 0);

    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "some text here that might be long"), 0);
}

TEST(SCALE, EncodingBoolean) {
    parser_context_t ctx;
    parser_error_t err;

    uint8_t buffer[100];
    auto bufferLen = parseHexString(
        buffer,
        sizeof(buffer),
        "82A9626F6F6C65616E5F30C3A9626F6F6C65616E5F31C2"
    );

    parser_init(&ctx, buffer, bufferLen);

    uint16_t mapItems {0};
    err = _readMap(&ctx, &mapItems);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(mapItems, 2);

    uint8_t key[50] = {0};
    uint8_t value {0};

    //Read key:value pos0
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "boolean_0"), 0);

    value = 0xFF;
    err = _readBool(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 1);

    //Read key:value pos1
    err = _readString(&ctx, key, sizeof(key));
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(strcmp((char*)key, "boolean_1"), 0);

    value = 0xFF;
    err = _readBool(&ctx, &value);
    EXPECT_EQ(err, parser_ok) << parser_getErrorDescription(err);
    EXPECT_EQ(value, 0);
}


