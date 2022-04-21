#ifndef _ALGO_UI_H_
#define _ALGO_UI_H_

#include <stdint.h>

extern char caption[20];
extern char text[128];
extern char blind_signing_flag;
#define BLIND_SIGNING_DISABLED 0
#define BLIND_SIGNING_ENABLED 1

void ui_idle();
void ui_address_approval();
void ui_txn();
void ux_approve_txn();

void ui_text_put(const char *msg);
void ui_text_put_u64(uint64_t v);

void switch_settings_blind_signing();
void ui_warning_blind_signing_data(void);

#define ALGORAND_DECIMALS 6
#endif
