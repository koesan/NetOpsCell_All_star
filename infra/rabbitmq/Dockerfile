FROM rabbitmq:3.13-management-alpine
COPY entrypoint.sh /usr/local/bin/netopscell-entrypoint.sh
RUN chmod +x /usr/local/bin/netopscell-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/netopscell-entrypoint.sh"]
CMD ["rabbitmq-server"]
