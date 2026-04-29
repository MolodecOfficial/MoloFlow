import mongoose from "mongoose";

const globalForMongo = globalThis as unknown as {
    mongoosePromise?: Promise<typeof mongoose>;
};

export default defineNitroPlugin(async (nitroApp) => {
    const config = useRuntimeConfig();
    const uri = config.mongodb;

    if (!uri) {
        console.error("❌ MONGODB_URI не задан в .env или nuxt.config.ts");
        return;
    }

    // Если уже есть активное соединение (readyState === 1), просто выходим без логов
    if (mongoose.connection.readyState === 1) {
        return;
    }

    // Если подключение уже в процессе (readyState === 2), тоже ничего не делаем
    if (mongoose.connection.readyState === 2) {
        return;
    }

    if (!globalForMongo.mongoosePromise) {
        console.log("⇆ Устанавливаю подключение к MongoDB...");
        globalForMongo.mongoosePromise = mongoose.connect(uri);
    } else {

        const isDisconnected = mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3;
        if (isDisconnected) {
            console.log("↺ Переподключение к MongoDB...");
        } else {
            // Если соединение активно или устанавливается — молчим
            return;
        }
    }

    try {
        await globalForMongo.mongoosePromise;
        if (mongoose.connection.readyState === 1) {
            console.log("✓ MongoDB успешно подключена");
        }
    } catch (error: any) {
        console.error("Ошибка подключения к MongoDB:", error.message);
        // Сбрасываем кеш, чтобы при следующем вызове попробовать снова
        globalForMongo.mongoosePromise = undefined;
    }
});