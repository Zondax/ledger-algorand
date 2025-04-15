/*******************************************************************************
*   (c) 2018 - 2025 Zondax AG
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
#include "crypto_utils.h"
#include "zxerror.h"
#if defined(LEDGER_SPECIFIC)
#include "cx.h"
#else
#include "picohash.h"
#endif

zxerr_t crypto_sha256(const uint8_t *in, uint16_t inLen, uint8_t *digest, uint16_t digestLen) {
#if defined(LEDGER_SPECIFIC)
    cx_sha256_t ctx;
    memset(&ctx, 0, sizeof(ctx));
    cx_sha256_init(&ctx);
    if (cx_hash_no_throw(&ctx.header, CX_LAST, in, inLen, digest, digestLen) != CX_OK) {
        return zxerr_unknown;
    }
#else
    picohash_ctx_t ctx;
    picohash_init_sha256(&ctx);
    picohash_update(&ctx, in, inLen);
    picohash_final(&ctx, digest);
#endif
    return zxerr_ok;
}