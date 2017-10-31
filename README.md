# THRIVE application

_Copyright (c) General Electric Company, 2017.  All rights reserved._

### To build the Docker image

To build the docker container for the path seed:

    $ docker build -t thrive:latest .

If you use HTTP proxies in your environment, you may need to build using

    $ docker build -t thrive:latest  --build-arg http_proxy=$http_proxy --build-arg https_proxy=$https_proxy  --build-arg no_proxy=$no_proxy .

### Configuring a database

### Downloading demo data (optional)

### Configuring local environment

Create a file called ```.env``` and set the path to your local datastore

```
LOCAL_DATA_DIR=/PathToLocalDatastore
```

### To run the path seed application

To run the path seed application

```
$ docker-compose up
```

Web pages for the application are served on port 81
