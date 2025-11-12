FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["npm", "start"]
