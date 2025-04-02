/*******************************************************************************
*   (c) 2018 - 2022 Zondax AG
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

#include <iostream>
#include <fstream>
#include <json/json.h>
#include <hexutils.h>
#include <parser_txdef.h>
#include "parser.h"
#include "app_mode.h"
#include "utils/common.h"

using ::testing::TestWithParam;

typedef struct {
    uint64_t index;
    std::string name;
    std::string blob;
    std::vector<std::string> expected;
    std::vector<std::string> expected_expert;
    std::string error;
} testcase_t;

// Create a separate class for each test suite
class JsonTestsTx : public ::testing::TestWithParam<testcase_t> {
public:
    struct PrintToStringParamName {
        template<class ParamType>
        std::string operator()(const testing::TestParamInfo<ParamType> &info) const {
            auto p = static_cast<testcase_t>(info.param);
            std::stringstream ss;
            ss << p.index << "_" << p.name;
            return ss.str();
        }
    };
};

class JsonTestsBigTx : public ::testing::TestWithParam<testcase_t> {
public:
    struct PrintToStringParamName {
        template<class ParamType>
        std::string operator()(const testing::TestParamInfo<ParamType> &info) const {
            auto p = static_cast<testcase_t>(info.param);
            std::stringstream ss;
            ss << p.index << "_" << p.name;
            return ss.str();
        }
    };
};

class JsonTestsArb : public ::testing::TestWithParam<testcase_t> {
public:
    struct PrintToStringParamName {
        template<class ParamType>
        std::string operator()(const testing::TestParamInfo<ParamType> &info) const {
            auto p = static_cast<testcase_t>(info.param);
            std::stringstream ss;
            ss << p.index << "_" << p.name;
            return ss.str();
        }
    };
};

// Retrieve testcases from json file
std::vector<testcase_t> GetJsonTestCases(std::string jsonFile) {
    auto answer = std::vector<testcase_t>();

    Json::CharReaderBuilder builder;
    Json::Value obj;

    std::string fullPathJsonFile = std::string(TESTVECTORS_DIR) + jsonFile;

    std::ifstream inFile(fullPathJsonFile);
    if (!inFile.is_open()) {
        return answer;
    }

    // Retrieve all test cases
    JSONCPP_STRING errs;
    Json::parseFromStream(builder, inFile, &obj, &errs);
    std::cout << "Number of testcases: " << obj.size() << std::endl;

    for (int i = 0; i < obj.size(); i++) {

        auto outputs = std::vector<std::string>();
        for (auto s : obj[i]["output"]) {
            outputs.push_back(s.asString());
        }

        auto outputs_expert = std::vector<std::string>();
        for (auto s : obj[i]["output_expert"]) {
            outputs_expert.push_back(s.asString());
        }

        // Check testcase contains error field
        std::string error;
        if (obj[i].isMember("error")) {
            error = obj[i]["error"].asString();
        } else {
            error = "No error";
        }

        answer.push_back(testcase_t{
                obj[i]["index"].asUInt64(),
                obj[i]["name"].asString(),
                obj[i]["blob"].asString(),
                outputs,
                outputs_expert,
                error
        });
    }

    return answer;
}

void check_testcase(const testcase_t &tc, bool expert_mode, txn_content_e content) {
    // Reset any global state here
    app_mode_set_expert(expert_mode);

    parser_context_t ctx;
    parser_error_t err;
    parser_tx_t tx_parser_obj;
    parser_arbitrary_data_t arb_parser_obj;

    // Initialize context to a known state
    memset(&ctx, 0, sizeof(parser_context_t));
    ctx.content = content;

    uint8_t buffer[20000];
    uint16_t bufferLen = parseHexString(buffer, sizeof(buffer), tc.blob.c_str());

    void *parser_obj = NULL;
    if (content == MsgPack) {
        parser_obj = &tx_parser_obj;
        memset(parser_obj, 0, sizeof(parser_tx_t));
        // Since we depend on default values, we need to initialize this every time (as we do in the app)
    } else if (content == ArbitraryData) {
        parser_obj = &arb_parser_obj;
        memset(parser_obj, 0, sizeof(parser_arbitrary_data_t));
    }

    err = parser_parse(&ctx, buffer, bufferLen, parser_obj, content);
    ASSERT_EQ(parser_getErrorDescription(err), tc.error) << parser_getErrorDescription(err);

    if (tc.error != "No error") {
        // If there is an error, we don't need to check the output
        return;
    }

    auto output = dumpUI(&ctx, 39, 39);

    std::cout << std::endl;
    for (const auto &i : output) {
        std::cout << i << std::endl;
    }
    std::cout << std::endl << std::endl;

    std::vector<std::string> expected = app_mode_expert() ? tc.expected_expert : tc.expected;
    EXPECT_EQ(output.size(), expected.size());
    for (size_t i = 0; i < expected.size(); i++) {
        if (i < output.size()) {
            EXPECT_THAT(output[i], testing::Eq(expected[i]));
        }
    }
}

INSTANTIATE_TEST_SUITE_P
(
    JsonTestCasesCurrentTxVer,
    JsonTestsTx,
    ::testing::ValuesIn(GetJsonTestCases("testcases/testcases.json")),
    JsonTestsTx::PrintToStringParamName()
);
TEST_P(JsonTestsTx, CheckUIOutput_Expert) { check_testcase(GetParam(), true, MsgPack); }

INSTANTIATE_TEST_SUITE_P
(
    JsonTestsBigTransactions,
    JsonTestsBigTx,
    ::testing::ValuesIn(GetJsonTestCases("testcases/testcases_big_transactions.json")),
    JsonTestsBigTx::PrintToStringParamName()
);
TEST_P(JsonTestsBigTx, CheckUIOutput) { check_testcase(GetParam(), true, MsgPack); }

INSTANTIATE_TEST_SUITE_P
(
    JsonTestsArbitrarySign,
    JsonTestsArb,
    ::testing::ValuesIn(GetJsonTestCases("testcases/testcases_arbitrary_sign.json")),
    JsonTestsArb::PrintToStringParamName()
);
TEST_P(JsonTestsArb, CheckUIOutput_Expert) { check_testcase(GetParam(), true, ArbitraryData); }