FROM node:20

WORKDIR /exco-backend

COPY package.json .

RUN npm install

COPY . .

CMD npm run start