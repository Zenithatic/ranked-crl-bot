FROM node:20 AS build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm ci


