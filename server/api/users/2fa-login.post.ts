// server/api/users/2fa-login.post.ts
// Второй шаг входа: проверка кода Google Authenticator. При успехе выдаёт токен пользователя.
import User from '~~/server/models/user.model'
import { verifyTotp } from '~~/server/utils/totp'
import { issueUserToken, setSessionCookie } from '~~/server/utils/sessionToken'

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) || {}
    const { userId, token, loginType, isFirstTime } = body

    if (!userId || !token) {
        throw createError({ statusCode: 400, message: 'Недостаточно данных для верификации' })
    }

    const user: any = await User.findById(userId)
    if (!user || !user.twoFactorSecret) {
        throw createError({ statusCode: 401, message: '2FA не сконфигурирована' })
    }

    const isValid = await verifyTotp(String(token).trim().replace(/\s+/g, ''), user.twoFactorSecret)
    if (!isValid) {
        throw createError({ statusCode: 401, message: 'Неверный код Google Authenticator' })
    }

    if (isFirstTime || !user.twoFactorEnabled) {
        user.twoFactorEnabled = true
        await user.save()
    }

    const sessionToken = issueUserToken(String(user._id))
    setSessionCookie(event, sessionToken)

    return {
        success: true,
        token: sessionToken,
        user: {
            _id: String(user._id),
            name: user.name,
            role: user.role,
            phone: user.phone || '',
            email: user.email || ''
        },
        loginType,
        message: 'Вход выполнен успешно'
    }
})
