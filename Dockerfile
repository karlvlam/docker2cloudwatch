FROM node:8.9.2-alpine

RUN mkdir -p /opt/docker2cloudwatch
RUN mkdir -p /opt/docker2cloudwatch/lib
WORKDIR /opt/docker2cloudwatch
COPY docker2cloudwatch.js /opt/docker2cloudwatch
COPY lib/ /opt/docker2cloudwatch/lib/

COPY package.json /opt/docker2cloudwatch
RUN npm install && npm cache clean --force

CMD [ "node", "--expose-gc", "/opt/docker2cloudwatch/docker2cloudwatch.js" ]
