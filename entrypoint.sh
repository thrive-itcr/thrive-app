#!/bin/sh
# Copyright (c) General Electric Company, 2017.  All rights reserved.

# Docker for Mac (docker-compose) tries to route local container traffic
# through the proxy.  Add the local hostname to no_proxy to circumvent any
# references this container makes to itself.
export no_proxy="$no_proxy,$HOSTNAME"
echo "no_proxy=$no_proxy"

npm start
