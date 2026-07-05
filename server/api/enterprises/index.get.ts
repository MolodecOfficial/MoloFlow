import Enterprise from '~~/server/models/enterprise.model'

export default defineEventHandler(async (event) => {
    const enterprises = await Enterprise.find();
    return {
        enterprises,
    };
});