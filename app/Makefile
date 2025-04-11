#*******************************************************************************
#  Ledger App
#  (c) 2018 - 2025 Zondax AG
#  (c) 2017 Ledger
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#*******************************************************************************

ifeq ($(BOLOS_SDK),)
$(error BOLOS_SDK is not set)
endif

MY_DIR := $(dir $(lastword $(MAKEFILE_LIST)))

## Display whether this is a production build or for internal use
PRODUCTION_BUILD ?= 1
ifeq ($(PRODUCTION_BUILD), 1)
    $(info ************ PRODUCTION_BUILD  = [PRODUCTION BUILD])
else
    $(info ************ PRODUCTION_BUILD  = [INTERNAL USE])
endif

DEFINES += PRODUCTION_BUILD=$(PRODUCTION_BUILD)

include $(CURDIR)/../deps/ledger-zxlib/makefiles/Makefile.app_testing

DEFINES += APP_BLINDSIGN_MODE_ENABLED

ifndef COIN
COIN=ALGO
endif

VARIANT_PARAM=COIN
VARIANT_VALUES=$(COIN)

include $(CURDIR)/Makefile.version
APPVERSION = "$(APPVERSION_M).$(APPVERSION_N).$(APPVERSION_P)"

# Application icons following guidelines:
# https://developers.ledger.com/docs/embedded-app/design-requirements/#device-icon
ICON_NANOS = nanos_icon.gif
ICON_NANOX = nanox_icon.gif
ICON_NANOSP = nanox_icon.gif
ICON_STAX = stax_icon.gif
ICON_FLEX = flex_icon.gif

$(info COIN  = [$(COIN)])

ifeq ($(COIN),ALGO)
# Main app configuration
DEFINES += APP_STANDARD
ifneq ($(TARGET_NAME),TARGET_NANOS)
DEFINES += SUBSTRATE_PARSER_FULL
endif
APPNAME = "Algorand"
APPPATH = "44'/283'"

DEFINES += APPPATH=\"$(APPPATH)\"

else
define error_message

COIN value not supported: [$(COIN)]

endef
$(error "$(error_message)")
endif

APP_LOAD_PARAMS = --curve ed25519 $(COMMON_LOAD_PARAMS) --path $(APPPATH)

include $(BOLOS_SDK)/Makefile.target

include $(CURDIR)/../deps/ledger-zxlib/makefiles/Makefile.devices

# Support for U2F transport
DEFINES += HAVE_U2F HAVE_IO_U2F U2F_PROXY_MAGIC=\"algo\" USB_SEGMENT_SIZE=64 BLE_SEGMENT_SIZE=32
SDK_SOURCE_PATH += lib_u2f

LDFLAGS  += -z muldefs
APP_SOURCE_PATH += $(MY_DIR)/../app/src/
APP_SOURCE_PATH += $(MY_DIR)/../deps/sha512
APP_SOURCE_PATH += $(MY_DIR)/../deps/picohash

include $(CURDIR)/../deps/ledger-zxlib/makefiles/Makefile.platform

include $(CURDIR)/../deps/ledger-zxlib/makefiles/Makefile.installer_script

$(info TARGET_NAME  = [$(TARGET_NAME)])
$(info ICONNAME  = [$(ICONNAME)])

ifndef ICONNAME
$(error ICONNAME is not set)
endif

# Enable QR code display for Flex and Stax
 ENABLE_NBGL_QRCODE ?= 1
 
# make rust a prerequisite for all object files 
$(OBJECT_FILES): | rust

.PHONY: rust
rust:
	@echo "No rust code"

.PHONY: rust_clean
rust_clean:
	@echo "No rust code"

clean: rust_clean


#add dependency on custom makefile filename
dep/%.d: %.c Makefile

.PHONY: version
version:
	@echo "v$(APPVERSION)" > app.version