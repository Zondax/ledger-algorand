/*******************************************************************************
*  (c) 2019 Zondax GmbH
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

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stddef.h>

typedef enum TxType {
  TX_UNKNOWN,
  TX_PAYMENT,
  TX_KEYREG,
  TX_ASSET_XFER,
  TX_ASSET_FREEZE,
  TX_ASSET_CONFIG,
  TX_APPLICATION,
  TX_ALL_TYPES,
} TxType;

#define KEY_TYPE "key"

typedef enum oncompletion {
  NOOPOC       = 0,
  OPTINOC      = 1,
  CLOSEOUTOC   = 2,
  CLEARSTATEOC = 3,
  UPDATEAPPOC  = 4,
  DELETEAPPOC  = 5,
} oncompletion_t;

struct asset_params {
  uint64_t total;
  uint64_t decimals;
  uint8_t default_frozen;
  char unitname[8];
  char assetname[32];
  char url[32];
  uint8_t metadata_hash[32];
  uint8_t manager[32];
  uint8_t reserve[32];
  uint8_t freeze[32];
  uint8_t clawback[32];
};

struct state_schema {
  uint64_t num_uint;
  uint64_t num_byteslice;
};

#define MAX_ACCT 2
typedef uint8_t accounts_t[MAX_ACCT][32];

#define MAX_ARG 2
#define MAX_ARGLEN 32
#define MAX_FOREIGN_APPS 1
#define MAX_FOREIGN_ASSETS 1
#define MAX_APPROV_LEN 128
#define MAX_CLEAR_LEN 32

// TXs structs
struct txn_payment {
  uint8_t receiver[32];
  uint64_t amount;
  uint8_t close[32];
};

struct txn_keyreg {
  uint8_t votepk[32];
  uint8_t vrfpk[32];
  uint8_t sprfkey[64];
  uint64_t voteFirst;
  uint64_t voteLast;
  uint64_t keyDilution;
  uint8_t nonpartFlag;
};

struct txn_asset_xfer {
  uint64_t id;
  uint64_t amount;
  uint8_t sender[32];
  uint8_t receiver[32];
  uint8_t close[32];
};

struct txn_asset_freeze {
  uint64_t id;
  uint8_t account[32];
  uint8_t flag;
};

struct txn_asset_config {
  uint64_t id;
  struct asset_params params;
};

struct txn_application {
  uint64_t id;
  uint64_t oncompletion;

  uint8_t accounts[MAX_ACCT][32];
  size_t num_accounts;

  uint64_t foreign_apps[MAX_FOREIGN_APPS];
  size_t num_foreign_apps;

  uint64_t foreign_assets[MAX_FOREIGN_ASSETS];
  size_t num_foreign_assets;

  uint8_t app_args[MAX_ARG][MAX_ARGLEN];
  size_t app_args_len[MAX_ARG];
  size_t num_app_args;

  uint8_t aprog[MAX_APPROV_LEN];
  size_t aprog_len;

  uint8_t cprog[MAX_CLEAR_LEN];
  size_t cprog_len;

  struct state_schema local_schema;
  struct state_schema global_schema;
};

typedef struct{
  TxType type;
  // Account Id asscociated with this transaction.
  uint32_t accountId;

  // Common header fields
  uint8_t sender[32];
  uint8_t rekey[32];
  uint64_t fee;
  uint64_t firstValid;
  uint64_t lastValid;
  char genesisID[32];
  uint8_t genesisHash[32];
  uint8_t groupID[32];

#if defined(TARGET_NANOS)
  uint8_t note[32];
#else
  uint8_t note[512];
#endif

  size_t note_len;

  // Fields for specific tx types
  union {
    struct txn_payment payment;
    struct txn_keyreg keyreg;
    struct txn_asset_xfer asset_xfer;
    struct txn_asset_freeze asset_freeze;
    struct txn_asset_config asset_config;
    struct txn_application application;
  };
} parser_tx_t;

typedef parser_tx_t txn_t;

#ifdef __cplusplus
}
#endif
