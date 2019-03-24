#!/bin/bash

docker login registry.gitlab.com
docker build -t registry.gitlab.com/einfach-gaming/gmod/egmrp/daemon .
docker push registry.gitlab.com/einfach-gaming/gmod/egmrp/daemon