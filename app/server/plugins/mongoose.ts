import mongoose from "mongoose";
import dns from "dns";

// Опционально: настраиваем Cloudflare DNS только если стандартный резолвер сбоит,
// либо аккуратно оборачиваем, чтобы не ронять системные запросы
try {
    dns.setServers(["1.1.1.1", "1.0.0.1"]);
} catch (e) {
    console.warn("⚠️ Не удалось установить кастомные DNS-серверы, используем системные");
}

const globalForMongo = globalThis as unknown as {
    mongoosePromise?: Promise<typeof mongoose> | null;
};

export default defineNitroPlugin(async () => {
    const config = useRuntimeConfig();
    // Берём из runtimeConfig, а если там пусто — напрямую из окружения процесса
    const uri = (config.mongodb as string) || process.env.MONGODB_URI;

    if (!uri) {
        console.error("❌ MONGODB_URI не задан в .env или nuxt.config.ts");
        return;
    }

    // Если уже есть активное или идущее подключение — выходим
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        return;
    }

    // Если промиса ещё нет или прошлый завершился ошибкой
    if (!globalForMongo.mongoosePromise) {
        console.log("⇆ Устанавливаю подключение к MongoDB...");

        globalForMongo.mongoosePromise = mongoose
            .connect(uri, {
                serverSelectionTimeoutMS: 10000, // Чтобы приложение не висело вечно, если нет сети
            })
            .then((m) => {
                console.log("✓ MongoDB успешно подключена");
                return m;
            })
            .catch((err) => {
                // Сбрасываем промис, чтобы следующая попытка могла инициировать новый connect
                globalForMongo.mongoosePromise = null;
                console.error("Ошибка подключения к MongoDB:", err?.message || err);
                throw err;
            });
    }

    try {
        await globalForMongo.mongoosePromise;
    } catch {
        // Ошибку уже залогировали в .catch выше
    }
});