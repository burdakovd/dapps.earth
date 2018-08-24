FROM joohoi/acme-dns:v0.5

RUN apk update && apk add bash

COPY config-template.cfg ./
COPY start.sh ./

# TODO: drop root

ENTRYPOINT []
CMD ["./start.sh"]
