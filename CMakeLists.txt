# *******************************************************************************
# *   (c) 2018 - 2024 Zondax AG
# *
# *  Licensed under the Apache License, Version 2.0 (the "License");
# *  you may not use this file except in compliance with the License.
# *  You may obtain a copy of the License at
# *
# *      http://www.apache.org/licenses/LICENSE-2.0
# *
# *  Unless required by applicable law or agreed to in writing, software
# *  distributed under the License is distributed on an "AS IS" BASIS,
# *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# *  See the License for the specific language governing permissions and
# *  limitations under the License.
# ********************************************************************************
cmake_minimum_required(VERSION 3.28)
include("cmake/HunterGate.cmake")
HunterGate(
    URL "https://github.com/cpp-pm/hunter/archive/v0.25.5.tar.gz"
    SHA1 "a20151e4c0740ee7d0f9994476856d813cdead29"
    LOCAL
)

if(CMAKE_GENERATOR MATCHES "Ninja")
        message(FATAL_ERROR "This project does not support the Ninja generator. "
                            "Please use Unix Makefiles or another supported generator. "
                            "This error is typical in CLion. In this case, switch to generator Unix Makefiles.")
endif()

########################################################

project(ledger-algorand VERSION 0.0.0)
set(CMAKE_CXX_STANDARD 17)
cmake_policy(SET CMP0025 NEW)
cmake_policy(SET CMP0144 NEW)

set(HUNTER_STATUS_DEBUG ON)
set(HUNTER_TLS_VERIFY OFF)

enable_testing()

option(ENABLE_FUZZING "Enable fuzzing instrumentation and build fuzz targets" OFF)
option(ENABLE_COVERAGE "Enable source code coverage instrumentation" OFF)
option(ENABLE_SANITIZERS "Enable ASAN and UBSAN" OFF)

string(APPEND CMAKE_C_FLAGS " -fno-omit-frame-pointer -g")
string(APPEND CMAKE_CXX_FLAGS " -fno-omit-frame-pointer -g")
string(APPEND CMAKE_LINKER_FLAGS " -fno-omit-frame-pointer -g")

hunter_add_package(fmt)
find_package(fmt CONFIG REQUIRED)

hunter_add_package(jsoncpp)
find_package(jsoncpp CONFIG REQUIRED)

hunter_add_package(GTest)
find_package(GTest CONFIG REQUIRED)

if(ENABLE_FUZZING)
        add_definitions(-DFUZZING_BUILD_MODE_UNSAFE_FOR_PRODUCTION=1)
        SET(ENABLE_SANITIZERS ON CACHE BOOL "Sanitizer automatically enabled" FORCE)
        SET(CMAKE_BUILD_TYPE Debug)

        if(DEFINED ENV{FUZZ_LOGGING})
                add_definitions(-DFUZZING_LOGGING)
                message(FATAL_ERROR "Fuzz logging enabled")
        endif()

        set(CMAKE_CXX_CLANG_TIDY clang-tidy -checks=-*,bugprone-*,cert-*,clang-analyzer-*,-cert-err58-cpp,misc-*)

        if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Clang")
                if(CMAKE_CXX_COMPILER_VERSION VERSION_LESS 10.0)
                        message(FATAL_ERROR "Clang version must be at least 10.0!")
                endif()
        else()
                message(FATAL_ERROR
                        "Unsupported compiler! Fuzzing requires Clang 10.\n"
                        "1. Install clang-10 \n"
                        "2. Use -DCMAKE_C_COMPILER=clang-10 -DCMAKE_CXX_COMPILER=clang++-10")
        endif()

        string(APPEND CMAKE_C_FLAGS " -fsanitize=fuzzer-no-link")
        string(APPEND CMAKE_CXX_FLAGS " -fsanitize=fuzzer-no-link")
        string(APPEND CMAKE_LINKER_FLAGS " -fsanitize=fuzzer-no-link")
endif()

if(ENABLE_COVERAGE)
        string(APPEND CMAKE_C_FLAGS " -fprofile-instr-generate -fcoverage-mapping")
        string(APPEND CMAKE_CXX_FLAGS " -fprofile-instr-generate -fcoverage-mapping")
        string(APPEND CMAKE_LINKER_FLAGS " -fprofile-instr-generate -fcoverage-mapping")
endif()

if(ENABLE_SANITIZERS)
        string(APPEND CMAKE_C_FLAGS " -fsanitize=address,undefined -fsanitize-recover=address,undefined")
        string(APPEND CMAKE_CXX_FLAGS " -fsanitize=address,undefined -fsanitize-recover=address,undefined")
        string(APPEND CMAKE_LINKER_FLAGS " -fsanitize=address,undefined -fsanitize-recover=address,undefined")
endif()

set(RETRIEVE_MAJOR_CMD
        "cat ${CMAKE_CURRENT_SOURCE_DIR}/app/Makefile.version | grep APPVERSION_M | cut -b 14- | tr -d '\n'"
)
set(RETRIEVE_MINOR_CMD
        "cat ${CMAKE_CURRENT_SOURCE_DIR}/app/Makefile.version | grep APPVERSION_N | cut -b 14- | tr -d '\n'"
)
execute_process(
        COMMAND bash "-c" ${RETRIEVE_MAJOR_CMD}
        RESULT_VARIABLE MAJOR_RESULT
        OUTPUT_VARIABLE MAJOR_VERSION
)
execute_process(
        COMMAND bash "-c" ${RETRIEVE_MINOR_CMD}
        RESULT_VARIABLE MINOR_RESULT
        OUTPUT_VARIABLE MINOR_VERSION
)

message(STATUS "LEDGER_MAJOR_VERSION [${MAJOR_RESULT}]: ${MAJOR_VERSION}")
message(STATUS "LEDGER_MINOR_VERSION [${MINOR_RESULT}]: ${MINOR_VERSION}")

add_definitions(
        -DLEDGER_MAJOR_VERSION=${MAJOR_VERSION}
        -DLEDGER_MINOR_VERSION=${MINOR_VERSION}
)

##############################################################
##############################################################
# Static Libraries
file(GLOB_RECURSE LIB_SRC
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/app_mode.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/base64.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/base58.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/bignum.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/hexutils.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/zxmacros.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/src/zxformat.c
        ####
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/crypto.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/crypto_utils.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/parser.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/addr.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/json/jsmn/jsmn.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/json/parser_json.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/cbor/parser_cbor.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/parser_impl.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/parser_encoding.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/algo_asa.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/sha512/sha512.c
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/base32.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/picohash/
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/tinycbor/src
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/tinycbor/src/cborparser.c
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/tinycbor/src/cborvalidation.c
        )

add_library(app_lib STATIC ${LIB_SRC})

target_include_directories(app_lib PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/ledger-zxlib/include
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/sha512
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/picohash
        ${CMAKE_CURRENT_SOURCE_DIR}/deps/tinycbor/src
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/lib
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/common
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/json/jsmn
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/json/
        ${CMAKE_CURRENT_SOURCE_DIR}/app/src/cbor/
        )

##############################################################
##############################################################
#  Fuzz Targets
if(ENABLE_FUZZING)
        set(FUZZ_TARGETS
                parser_parse
        )

        foreach(target ${FUZZ_TARGETS})
                add_executable(fuzz-${target} ${CMAKE_CURRENT_SOURCE_DIR}/fuzz/${target}.cpp)
                target_link_libraries(fuzz-${target} PRIVATE app_lib)
                target_link_options(fuzz-${target} PRIVATE "-fsanitize=fuzzer")
        endforeach()
else()
#############################################################
# Tests
        file(GLOB_RECURSE TESTS_SRC
                ${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp)

        add_executable(unittests ${TESTS_SRC})
        target_include_directories(unittests PRIVATE
                "${GTEST_ROOT}/include"
                fmt::fmt
                jsoncpp::jsoncpp
        )

        target_link_libraries(unittests PRIVATE
                app_lib
                GTest::gtest_main
                fmt::fmt
                JsonCpp::JsonCpp)

        add_compile_definitions(TESTVECTORS_DIR="${CMAKE_CURRENT_SOURCE_DIR}/tests/")
        add_test(NAME unittests COMMAND unittests)
        set_tests_properties(unittests PROPERTIES WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests)
endif()
