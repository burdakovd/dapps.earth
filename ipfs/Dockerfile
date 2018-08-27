FROM jbenet/go-ipfs:release

COPY start.sh ./

ENTRYPOINT ["/sbin/tini", "--", "./start.sh"]
