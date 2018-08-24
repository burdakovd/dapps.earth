FROM ubuntu

RUN mkdir -p /usr/local/bin
RUN apt-get update && \
  apt-get -y --no-install-recommends install wget ca-certificates git
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

FROM neilpang/acme.sh

RUN apk update && apk add bash jq bc

COPY --from=0 /usr/local/bin/dumb-init /usr/local/bin/dumb-init
COPY --from=0 /bin/wait-for /bin/wait-for
COPY start.sh ./

VOLUME /acme-dns-auth
VOLUME /successes
VOLUME /etc/nginx/certs

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

CMD ["./start.sh"]
