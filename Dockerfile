FROM gcr.io/distroless/static@sha256:448810357cc8e67b7208988abdba0f5ec3d3aebee0a5b13eb624979792cffc0f
COPY egmrp-daemon  /
ENTRYPOINT ["/egmrp-daemon"]
