FROM ghcr.io/euro-office/documentserver:9.3.1
USER root
COPY start.sh /app/ds/amerika-start.sh
RUN chmod 755 /app/ds/amerika-start.sh
ENTRYPOINT ["/app/ds/amerika-start.sh"]
