FROM selenium/standalone-chrome:latest

USER root

ARG BINARY_PATH=target/release/hikari-screenshot
COPY ${BINARY_PATH} /usr/local/bin/hikari-screenshot

RUN chmod +x /usr/local/bin/hikari-screenshot \
    && mkdir -p /tmp/e2e_screenshots \
    && chown seluser:seluser /tmp/e2e_screenshots

USER seluser

ENV RUST_BACKTRACE=1
ENV RUST_LOG=info
ENV CHROME_BIN=/usr/bin/google-chrome
ENV SCREENSHOT_DIR=/tmp/e2e_screenshots
ENV BASE_URL=http://host.docker.internal:3000

CMD ["/usr/local/bin/hikari-screenshot", "--start", "0"]
