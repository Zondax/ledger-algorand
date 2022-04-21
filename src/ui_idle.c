#include "os.h"
#include "os_io_seproxyhal.h"
#include "str.h"
#include "algo_ui.h"
#include "ux.h"

void display_settings(const ux_flow_step_t* const start_step);

UX_STEP_NOCB(
    ux_idle_flow_welcome_step,
    nn, //pnn,
    {
      //"", //&C_icon_dashboard,
      "Application",
      "is ready",
    });
UX_STEP_NOCB(
    ux_idle_flow_version_step,
    bn,
    {
      "Version",
      APPVERSION,
    });
UX_STEP_CB(
    ux_idle_flow_settings_step,
    pb,
    display_settings(NULL),
    {
      &C_icon_dashboard_x,
      "Settings",
    });
UX_STEP_CB(
    ux_idle_flow_exit_step,
    pb,
    os_sched_exit(-1),
    {
      &C_icon_dashboard_x,
      "Quit",
    });
UX_FLOW(ux_idle_flow,
  &ux_idle_flow_welcome_step,
  &ux_idle_flow_version_step,
  &ux_idle_flow_settings_step,
  &ux_idle_flow_exit_step,
  FLOW_LOOP
);

UX_STEP_CB(
    ux_settings_flow_1_step,
    bnnn_paging,
    switch_settings_blind_signing(),
    {
      .title = "Blind signing",
      .text = text,
    });
UX_STEP_CB(
    ux_settings_flow_2_step,
    pb,
    ui_idle(),
    {
      &C_icon_back_x,
      "Back",
    });
UX_FLOW(ux_settings_flow,
        &ux_settings_flow_1_step,
        &ux_settings_flow_2_step);

void display_settings(const ux_flow_step_t* const start_step) {
    strlcpy(text, (blind_signing_flag ? "Enabled" : "NOT Enabled"), 12);
    ux_flow_init(0, ux_settings_flow, start_step);
}

void switch_settings_blind_signing() {
    char value = (blind_signing_flag ? BLIND_SIGNING_DISABLED : BLIND_SIGNING_ENABLED);
    blind_signing_flag = value;
    display_settings(&ux_settings_flow_1_step);
}

void
ui_idle(void)
{
  // reserve a display stack slot if none yet
  if(G_ux.stack_count == 0) {
    ux_stack_push();
  }
  ux_flow_init(0, ux_idle_flow, NULL);
}
