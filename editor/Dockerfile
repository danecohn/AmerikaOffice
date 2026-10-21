FROM onlyoffice/documentserver:10.0.0
USER root
COPY start.sh /app/ds/amerika-start.sh
RUN chmod 755 /app/ds/amerika-start.sh
ENTRYPOINT ["/app/ds/amerika-start.sh"]
