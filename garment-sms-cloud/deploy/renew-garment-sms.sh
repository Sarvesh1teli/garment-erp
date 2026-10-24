#!/bin/sh
set -eu
case " ${RENEWED_DOMAINS:-} " in
  *" grm-bill-sms.telisoftware.com "*) /usr/sbin/nginx -t && /bin/systemctl reload nginx ;;
esac
