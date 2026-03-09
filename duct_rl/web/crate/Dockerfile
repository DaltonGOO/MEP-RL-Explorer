FROM rust:1.83-slim

RUN cargo install wasm-pack

WORKDIR /crate
COPY Cargo.toml .
COPY src/ src/
COPY tests/ tests/

# Build WASM package
RUN wasm-pack build --target web --out-dir /crate/pkg

# Copy built artifacts to the output volume on startup
CMD ["cp", "-r", "/crate/pkg/.", "/output/"]
