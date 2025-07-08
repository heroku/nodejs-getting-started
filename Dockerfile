FROM node:latest
WORKDIR /app
COPY . .
RUN nmp install
EXPOSE 3000
CMD ["nmp", "run", "test"]
