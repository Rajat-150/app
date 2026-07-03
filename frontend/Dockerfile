FROM node:20-alpine AS build
WORKDIR /app
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
COPY package.json ./
# yarn.lock is optional (Emergent's Save-to-GitHub sometimes strips large lockfiles)
COPY yarn.loc[k] ./
RUN yarn install --network-timeout 600000
COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
