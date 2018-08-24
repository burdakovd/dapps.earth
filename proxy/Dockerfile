FROM node:8.9.1

RUN apt-get install wget
RUN \
  wget \
  https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64.deb \
  && dpkg -i dumb-init_*.deb

WORKDIR /code

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --production

COPY app.js ./

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# TODO: change user

CMD ["/usr/local/bin/node", "app.js"]
