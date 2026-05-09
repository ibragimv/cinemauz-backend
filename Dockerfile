FROM node:18-slim

# Hugging Face uchun maxsus foydalanuvchi yaratish
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app

# Fayllarni nusxalash va huquqlarni berish
COPY --chown=user package*.json ./
RUN npm install --production

COPY --chown=user . .

# Port sozlamalari
ENV PORT=7860
EXPOSE 7860

CMD ["node", "src/app.js"]
