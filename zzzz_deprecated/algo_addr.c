#include <string.h>
// #include "os.h"
// #include "cx.h"

#include "algo_addr.h"
#include "base32.h"
#include "base64.h"

#include "sha512.h"
#define CX_SHA512_SIZE 64

#include "zxmacros.h"
#include "inttypes.h"
#include "stdint.h"

// uint8_t convert_to_public_address(const uint8_t *publicKey, unsigned char *output_public_address)
// {
//   ZEMU_LOGF(200, "FT PUBLIC ADDRESS\n")
//   // // The SDK does not provide a ready-made SHA512/256, so we set up a SHA512
//   // // hash context, and then overwrite the IV with the SHA512/256-specific IV.
//   // cx_sha512_t h;
//   // explicit_bzero(&h, sizeof(h));
//   // cx_sha512_init(&h);

//   // static const uint64_t sha512_256_state[8] = {
//   //   0x22312194fc2bf72c, 0x9f555fa3c84c64c2, 0x2393b86b6f53b151, 0x963877195940eabd,
//   //   0x96283ee2a88effe3, 0xbe5e1e2553863992, 0x2b0199fc2c85b8aa, 0x0eb72ddc81c52ca2
//   // };

//   // for (int i = 0; i < 8; i++) {
//   //   uint64_t iv = sha512_256_state[i];
//   //   for (int j = 0; j < 8; j++) {
//   //     h.acc[i*8 + j] = iv & 0xff;
//   //     iv = iv >> 8;
//   //   }
//   // }

//   // uint8_t hash[64];
//   // cx_hash(&h.header, CX_LAST, publicKey, 32, hash, sizeof(hash));

//   // uint8_t checksummed[36];
//   // memmove(&checksummed[0], publicKey, 32);
//   // memmove(&checksummed[32], &hash[28], 4);

//   // base32_encode(checksummed, sizeof(checksummed), (unsigned char*) output_public_address);
//   zemu_log_stack("BEFORE CONVERTING2");
//   convert_to_public_address2(publicKey, output_public_address);
//   return 65;
// }

// uint8_t convert_to_public_address2(const uint8_t *publicKey, unsigned char *output_public_address)
// {
//     // cx_sha512_t h;
//     // explicit_bzero(&h, sizeof(h));
//     // cx_sha512_init(&h);

//     // static const uint64_t sha512_256_state[8] = {
//     //   0x22312194fc2bf72c, 0x9f555fa3c84c64c2, 0x2393b86b6f53b151, 0x963877195940eabd,
//     //   0x96283ee2a88effe3, 0xbe5e1e2553863992, 0x2b0199fc2c85b8aa, 0x0eb72ddc81c52ca2
//     // };

//     // for (int i = 0; i < 8; i++) {
//     //   uint64_t iv = sha512_256_state[i];
//     //   for (int j = 0; j < 8; j++) {
//     //     h.acc[i*8 + j] = iv & 0xff;
//     //     iv = iv >> 8;
//     //   }
//     // }

//     // uint8_t hash[64];
//     // cx_hash(&h.header, CX_LAST, publicKey, 32, hash, sizeof(hash));


//   zemu_log_stack("BEFORE SHA512 00");
//     ZEMU_LOGF(100, "FT CHECK 000\n")
//     uint8_t messageDigest[CX_SHA512_SIZE];
//     SHA512_256(publicKey, 32, messageDigest);

//     ZEMU_LOGF(100, "FT CHECK 001\n")

//     // bool hash_match = true;
//     // for(uint8_t i = 0; i < 64; i++) {
//     //   if(messageDigest[i] != hash[i]) {
//     //     hash_match = false;
//     //   }
//     //   // ZEMU_LOGF(50, "SHA: %d | %d\n", i, messageDigest[i])
//     //   // ZEMU_LOGF(50, "ALGO: %d | %d\n", i, hash[i])
//     // }
//     // ZEMU_LOGF(50, "HASH MATCHING: %d\n", hash_match)


//     zemu_log_stack("BEFORE SHA512 01");
//     uint8_t checksummed[36];
//     memmove(&checksummed[0], publicKey, 32);
//     ZEMU_LOGF(200, "FT CHECK 002\n")
//     memmove(&checksummed[32], &messageDigest[28], 4);
//     ZEMU_LOGF(200, "FT CHECK 003\n")

//     zemu_log_stack("BEFORE SHA512 02");
//     // base32_encode(checksummed, sizeof(checksummed), (unsigned char*) output_public_address);

//     base32_encode(checksummed, sizeof(checksummed), (char*)output_public_address, 65);

//     zemu_log_stack("BEFORE SHA512 03");
//     return 65;
// }
