FROM gcr.io/distroless/static
COPY egmrp-daemon  /
ENTRYPOINT ["/egmrp-daemon"]
