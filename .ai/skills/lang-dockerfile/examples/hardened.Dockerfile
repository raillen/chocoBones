# Build Stage
FROM golang:1.24-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o /bin/app ./cmd/server

# Final Runtime Stage
FROM gcr.io/distroless/static-debian12:nonroot
USER 65532:65532
WORKDIR /app
COPY --from=builder /bin/app /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]\n