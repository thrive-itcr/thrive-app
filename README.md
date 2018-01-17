# THRIVE application

_Copyright (c) General Electric Company, 2017.  All rights reserved._

### To build the Docker image

To build the docker container for thrive-app:

    $ docker build -t thrive/thrive-app .

If you use HTTP proxies in your environment, you may need to build using

    $ docker build -t thrive/thrive-app  --build-arg http_proxy=$http_proxy --build-arg https_proxy=$https_proxy  --build-arg no_proxy=$no_proxy .

