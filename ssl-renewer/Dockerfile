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

FROM neilpang/acme.sh

RUN apk update && apk add bash bc bind-tools python2 py-pip git

RUN pip install docutils && pip install python-daemon
RUN pip install git+git://github.com/paulchakravarti/dnslib.git@986861873ee6131dae60820b8a804f710f87dd8
RUN addgroup -S nano-dns && adduser -S -G nano-dns nano-dns

COPY --from=0 /usr/local/bin/dumb-init /usr/local/bin/dumb-init
COPY start.sh ./
COPY nano-dns.py ./

VOLUME /acme-dns-auth
VOLUME /successes
VOLUME /etc/nginx/certs

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

CMD ["./start.sh"]
