# A containerfile to build the microservice that presents data held within an IBM Db2 database as API calls.
# This takes the node.js code in this repository and builds a container image to run it.
# This will build for the ppc64le architecture **only**.

# Base image is currently CentOS 7
FROM quay.io/andrewlaidlaw/centos:7

LABEL "maintainer"="Andrew Laidlaw [andrew.laidlaw@uk.ibm.com]"
LABEL "version"="1.3"
LABEL "description"="Microservice to present data in IBM Db2 sample database as API endpoints."

# runtime support to enable npm build capabilities
RUN yum update -y && yum -y install make gcc-c++ python3 numactl-devel

# XLC runtime support - required by ibm_db node package
# RUN curl -sL http://public.dhe.ibm.com/software/server/POWER/Linux/xl-compiler/eval/ppc64le/rhel7/ibm-xl-compiler-eval.repo > /etc/yum.repos.d/xl-compilers.repo \
#        && yum -y install libxlc

# install v14 LTS node.js for ppc64le
RUN cd /usr/local \
       && curl -sL https://nodejs.org/dist/v14.17.5/node-v14.17.5-linux-ppc64le.tar.gz > node-v14.17.5-linux-ppc64le.tar.gz \
       && tar --strip-components 1 -xf node-v14.17.5-linux-ppc64le.tar.gz

# install required node.js pacakges using npm
COPY package*.json ./
RUN npm install

# copy our node.js application code into the image
COPY test.js .

# expose the required port to access our code
EXPOSE 8080

# on start run our node.js application
CMD [ "node", "test.js" ]