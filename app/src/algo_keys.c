#include "os.h"
#include "cx.h"
#include "os_io_seproxyhal.h"

#include "algo_keys.h"

#include "zxmacros_ledger.h"
#include "zxmacros.h"
#include "coin.h"


static zxerr_t algorand_key_derive(uint32_t account_id, cx_ecfp_private_key_t *private_key)
{
  zxerr_t err = zxerr_ok;
  uint8_t  private_key_data[SK_LEN_25519];
  uint32_t hdPath[HDPATH_LEN_DEFAULT];
  cx_ecfp_private_key_t local_private_key;

  explicit_bzero(&local_private_key,sizeof(local_private_key));
  explicit_bzero(private_key_data,sizeof(private_key_data));

  hdPath[0] = 44  | 0x80000000;
  hdPath[1] = 283 | 0x80000000;
  hdPath[2] = account_id | 0x80000000;
  hdPath[3] = 0;
  hdPath[4] = 0;

  io_seproxyhal_io_heartbeat();

  BEGIN_TRY
  {
    TRY
    {
      os_perso_derive_node_bip32(
        CX_CURVE_Ed25519,
        hdPath,
        HDPATH_LEN_DEFAULT,
        private_key_data,
        NULL);

      cx_ecfp_init_private_key(CX_CURVE_Ed25519, private_key_data, 32, &local_private_key);
      MEMCPY(private_key, &local_private_key, sizeof(local_private_key));
    }
    CATCH_OTHER(e)
    {
        zemu_log("Exception caught while deriving the private key\n");
        err = zxerr_unknown;
    }
    FINALLY
    {
      explicit_bzero(&local_private_key,sizeof(local_private_key));
      explicit_bzero(private_key_data,sizeof(private_key_data));
    }
  }
  END_TRY;

  io_seproxyhal_io_heartbeat();

  return err;
}

static void get_public_key_from_private_key(const cx_ecfp_private_key_t *cx_privateKey,
                                            struct pubkey_s *pubKey)
{
  cx_ecfp_public_key_t cx_publicKey;

  cx_ecfp_generate_pair(CX_CURVE_Ed25519,
                        &cx_publicKey,
                        (cx_ecfp_private_key_t *)cx_privateKey,
                        1);

  // publicKey.W is 65 bytes: a header byte, followed by a 32-byte
  // x coordinate, followed by a 32-byte y coordinate.  The bytes
  // representing the coordinates are in reverse order.

  for (unsigned int i = 0; i < PK_LEN_25519; i++) {
    pubKey->data[i] = cx_publicKey.W[64-i];
  }

  if ((cx_publicKey.W[PK_LEN_25519] & 1) != 0) {
    pubKey->data[31] |= 0x80;
  }
}


/*
* This function returns a public key conresponding to the account ID given.
* The function fails if the the size of out_pub_key is smaller than 32 bytes (validated with out_pub_key_size arg) .
*/

zxerr_t fetch_public_key(uint32_t account_id, struct pubkey_s *pubKey)
{
  zxerr_t err = zxerr_ok;
  cx_ecfp_private_key_t private_key;
  explicit_bzero(&private_key, sizeof(private_key));
  err = algorand_key_derive(account_id, &private_key);
  if (err != zxerr_ok) {
    return err;
  }

  BEGIN_TRY
  {
    TRY
    {
      get_public_key_from_private_key(&private_key, pubKey);
    }
    CATCH_OTHER(e)
    {
      zemu_log("Exception caught while using fecthing the public key\n");
      err = zxerr_unknown;
    }
    FINALLY
    {
      explicit_bzero(&private_key, sizeof(private_key));
    }
  }
  END_TRY;

  return err;
}

int algorand_sign_message(uint32_t account_id, const uint8_t* msg_to_sign,
                          const uint32_t msg_len, uint8_t* out_signature_buffer,
                          int *sign_size)
{
  int error;
  cx_ecfp_private_key_t private_key;
  explicit_bzero(&private_key,sizeof(private_key));

  error = algorand_key_derive(account_id, &private_key);
  if (error) {
    return error;
  }

  io_seproxyhal_io_heartbeat();

  BEGIN_TRY
  {
    TRY
    {
      *sign_size = cx_eddsa_sign(&private_key,
                     0, CX_SHA512,
                     msg_to_sign, msg_len,
                     NULL, 0,
                     out_signature_buffer,
                     6+2*(32+1), // Formerly from cx_compliance_141.c
                     NULL);
    }
    CATCH_OTHER(e)
    {
      zemu_log("Exception caught while signing transaction\n");
      error = e;
    }
    FINALLY
    {
      explicit_bzero(&private_key,sizeof(private_key));
    }
  }
  END_TRY;

  io_seproxyhal_io_heartbeat();

  return error;
}
