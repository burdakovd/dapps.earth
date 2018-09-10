#!/bin/bash -uxv
docker run -e JUST_PRINT_AUDIT_PAGE=1 dappsearth_frontend > audit.html
