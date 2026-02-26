FROM gcr.io/distroless/static@sha256:eca24e67792afe660769e84c85332d9939772e7f76071597d179af96ac4e9e4f
COPY egmrp-daemon  /
ENTRYPOINT ["/egmrp-daemon"]
