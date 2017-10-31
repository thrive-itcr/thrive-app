#!/bin/bash
# Copyright (c) General Electric Company, 2017.  All rights reserved.

echo ""
echo "Removing web image."
docker rmi thrive:latest

echo ""
echo "Building web image."
docker build -t thrive:latest --build-arg http_proxy=$http_proxy --build-arg https_proxy=$https_proxy  --build-arg no_proxy=$no_proxy .

echo ""
docker images