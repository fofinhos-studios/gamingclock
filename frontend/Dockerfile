FROM rust:1.91-bookworm AS aube
RUN cargo install aube --version 1.39.0 --locked

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY --from=aube /usr/local/cargo/bin/aube /usr/local/bin/aube
COPY package.json aube-lock.yaml ./
RUN aube install --frozen-lockfile

COPY . .
RUN aube build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
