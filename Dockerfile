FROM node:18-slim

# Ishchi katalogni yaratish
WORKDIR /app

# Bog'liqliklarni o'rnatish
COPY package*.json ./
RUN npm install --production

# Loyiha kodini nusxalash
COPY . .

# Hugging Face Spaces porti (majburiy 7860)
ENV PORT=7860
EXPOSE 7860

# Dasturni ishga tushirish
CMD ["node", "src/app.js"]
