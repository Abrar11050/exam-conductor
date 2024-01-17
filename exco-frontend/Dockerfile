# build stage
FROM node:20 as builder

WORKDIR /exco-frontend

COPY package.json .

RUN npm install

COPY . .

ARG REACT_APP_BASE_API_URL
ENV REACT_APP_BASE_API_URL=$REACT_APP_BASE_API_URL

RUN npm run build

# run stage
FROM nginx:1.17.0-alpine

COPY --from=builder /exco-frontend/build /usr/share/nginx/html

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE $REACT_DOCKER_PORT

CMD nginx -g 'daemon off;'
