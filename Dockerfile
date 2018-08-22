FROM node:8.9.1

WORKDIR /code

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --production

COPY app.js ./

EXPOSE 8080

CMD yarn start
