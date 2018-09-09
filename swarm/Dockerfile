FROM ubuntu as tools
RUN apt-get update && apt-get -y install curl tar ca-certificates
RUN curl -f -L \
  https://github.com/sequenceiq/docker-alpine-dig/releases/download/v9.10.2/dig.tgz \
  | tar -xzv -C /usr/local/bin/

RUN curl --fail --silent --show-error \
  https://gist.githubusercontent.com/homotopycolimit/db446fa3269a199762e67b2ca037dbeb/raw/8c522a4e64cf02ae0b02f4115bc84d12a5fa85ad/gistfile1.txt \
  > /etc/bootnodes.raw.txt

# Pick some addresses from the middle
RUN cat /etc/bootnodes.raw.txt | sort -R | head -n2 | awk -F '"' '{print $2}' > /etc/bootnodes.txt \
  && tail -v -n +1 /etc/bootnodes.txt

FROM ethereum/client-go:alltools-stable
RUN echo 1234 > /etc/1234
RUN apk update && apk add bash curl jq
RUN adduser -D -h /home/swarmuser -u 1001 -G users swarmuser

RUN mkdir /home/swarmuser/data
RUN chown swarmuser:users /home/swarmuser/data

VOLUME /home/swarmuser/data

COPY --chown=root:root ./start.sh /bin/start.sh

COPY --from=tools /usr/local/bin/dig /usr/bin/dig
COPY --from=tools /etc/bootnodes.txt /etc/bootnodes.txt

USER swarmuser
ENTRYPOINT []
CMD [ "/bin/start.sh" ]
