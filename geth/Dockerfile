FROM alpine:latest as tools
RUN apk update && apk add curl tar
RUN curl -f -L \
  https://github.com/sequenceiq/docker-alpine-dig/releases/download/v9.10.2/dig.tgz \
  | tar -xzv -C /usr/local/bin/

FROM ethereum/client-go:stable
RUN apk update && apk add bash
RUN adduser -D -h /home/gethuser -u 1001 -G users gethuser

RUN mkdir /home/gethuser/.ethereum
RUN chown gethuser:users /home/gethuser/.ethereum

COPY --chown=root:root bootnodes.txt /etc/bootnodes.txt

VOLUME /home/gethuser/.ethereum

COPY --from=tools /usr/local/bin/dig /usr/bin/dig

USER gethuser
ENTRYPOINT []
CMD [ \
  "bash", \
  "-exc", \
  "exec geth --nousb --syncmode light \
    --nat \
      extip:$(/usr/bin/dig +short myip.opendns.com @resolver1.opendns.com) \
    --bootnodes \
      $(cat /etc/bootnodes.txt | grep -v '#' | grep '.' | paste -sd,) \
    --rpc \
    --rpcaddr 0.0.0.0 \
    --rpcport 8545 \
    --rpcapi 'eth,net,web3,personal' \
    --verbosity 4 \
    --rpcvhosts=geth \
  " \
]
