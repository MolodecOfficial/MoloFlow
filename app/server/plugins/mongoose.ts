import mongoose from "mongoose";

export default defineNitroPlugin(async (nitroApp) => {
    const config = useRuntimeConfig();
    const uri = config.mongodb;

    console.log("🧩 Плагин Mongoose успешно загружен!");
    console.log("🔍 Проверяю MongoDB URI:", uri ? "Найден!" : "Утерян");

    if (!uri) {
        console.error("❌ Утерян MONGODB_URI в .env или nuxt.config.ts");
        return;
    }

    if (mongoose.connection.readyState === 1) {
        console.log("✅ MongoDB успешно запущен!");
        return;
    }

    console.log("🔌 Подключаюсь к MongoDB...");
    try {
        await mongoose.connect(uri);
        console.log("✅  MongoDB успешно подключен!");
    } catch (error: any) {
        console.error("❌ MongoDB неожиданно отключился:", error.message);
    }
});
