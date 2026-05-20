# auth

JWT с парой токенов (access 15m + refresh 7d) и ротацией refresh.

## Поток

1. `POST /auth/login` — bcrypt-сверка пароля → выдача access+refresh, refresh
   хэшируется и сохраняется в `refresh_tokens`.
2. `POST /auth/refresh` — проверяет refresh по хэшу, помечает `revokedAt`,
   выдаёт новую пару (rotation).
3. `POST /auth/logout` — Bearer-защищённый, аннулирует переданный refresh.

## Что важно знать

- `JwtAuthGuard` использует `passport-jwt`, токен в `Authorization: Bearer`.
- `req.user.userId` — это `sub` из JWT (UUID пользователя). Используется во
  всех контроллерах (dialogs/submissions/checks).
- Секреты в `.env`: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`,
  `JWT_REFRESH_EXPIRES_IN`. **Менять в production**.
- Токены подписаны разными секретами — нельзя использовать access вместо
  refresh и наоборот.

## Тесты

Не покрыты unit-тестами — JWT и bcrypt валидируются smoke-тестом из README
(login → передача токена → доступ к защищённым эндпоинтам).
