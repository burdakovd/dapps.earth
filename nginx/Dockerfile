FROM debian:stable

# Put this first to recompute this layer less frequently
# as it is pretty slow
RUN apt-get update && apt-get -y --no-install-recommends install openssl
RUN openssl dhparam -out /dhparam.pem 2048

RUN apt-get update && apt-get -y --no-install-recommends install \
  wget ca-certificates git

RUN \
  wget -O /usr/local/bin/dumb-init \
  https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64 && \
  echo "057ecd4ac1d3c3be31f82fc0848bf77b1326a975b4f8423fe31607205a0fe945 /usr/local/bin/dumb-init" | \
    sha256sum -c - && \
  chmod 755 /usr/local/bin/dumb-init

RUN cd /tmp && \
  git clone https://github.com/mrako/wait-for.git && \
  cd wait-for && \
  git checkout d9699cb9fe8a4622f05c4ee32adf2fd93239d005 && \
  cp -v wait-for /bin/ && \
  cd /tmp && \
  rm -r /tmp/wait-for


FROM node:10-alpine

RUN mkdir /root/html
WORKDIR /root/html
COPY html/package.json ./
COPY html/yarn.lock ./
RUN yarn install
COPY html/src ./src
COPY html/static ./static
COPY html/webpack.config.js ./
RUN rm -f ./src/README.md
COPY README.md ./src/README.md
RUN npx webpack --mode=production


FROM nginx:stable

RUN apt-get update && \
  apt-get -y --no-install-recommends install inotify-tools

VOLUME /etc/nginx/certs

WORKDIR /root
COPY nginx/start.sh ./
COPY nginx/nginx-template.conf /etc/nginx/nginx-template.conf

RUN rm -rf /var/www/ && mkdir /var/www
COPY --from=0 /dhparam.pem /etc/nginx/dhparam.pem
COPY --from=0 /usr/local/bin/dumb-init /usr/local/bin/dumb-init
COPY --from=0 /bin/wait-for /bin/wait-for
COPY --from=1 /root/html/dist /var/www/static
COPY README.md /var/www/static/README.md

VOLUME /var/log/dapps.earth-integrity

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]
CMD ["./start.sh"]
