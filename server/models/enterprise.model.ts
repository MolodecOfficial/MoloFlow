import mongoose from "mongoose";

const enterpriseSchema = new mongoose.Schema({
    enterpriseName: {
        type: String,
        required: true,
    },
    inn: {
        type: Number,
        required: true,
    },
    kpp: {
        type: Number,
        required: true,
    },
    ogrn: {
        type: Number,
        required: true,
    },
    legalAddress: {
        type: String,
        required: true,
    },
    actualAddress: {
        type: String,
    },
    phone: {
        type: Number,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    director: {
        type: String,
        required: true,
    },
    okved: {
        type: Number,
        required: true,
    },
    keypass: {
        type: String,
        required: true,
    },
    ownershipForm: {
        type: String,
        required: true
    },
})

export const Enterprise = mongoose.models.Enterprise || mongoose.model('Enterprise', enterpriseSchema);

export default mongoose.model('Enterprise', enterpriseSchema);