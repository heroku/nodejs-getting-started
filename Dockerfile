FROM ubuntu:22.04

WORKDIR /app

COPY . .

RUN apt-get update

CMD ["bash"]
