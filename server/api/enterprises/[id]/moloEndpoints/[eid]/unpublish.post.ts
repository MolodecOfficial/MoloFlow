import {createError, defineEventHandler, getRouterParam} from 'h3'
import mongoose from 'mongoose'
import {tenantModels} from '~~/server/utils/tenantDb'
import {resolveActor, toHttpError} from '~~/server/utils/moloDb/access'
import {unpublishMoloFlowSnapshot} from '~~/server/utils/moloFlowConnect'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || '';
        const eid = getRouterParam(event, 'eid') || '';
        if (!mongoose.Types.ObjectId.isValid(enterpriseId) || !mongoose.Types.ObjectId.isValid(eid)) throw createError({
            statusCode: 400,
            message: 'Некорректный идентификатор предприятия или эндпоинта'
        });
        await resolveActor(event, enterpriseId, 'schema');
        const Endpoint = tenantModels(enterpriseId).MoloEndpoint;
        const endpoint: any = await Endpoint.findOne({_id: eid, enterpriseId}).lean();
        if (!endpoint) throw createError({statusCode: 404, message: 'Эндпоинт не найден'});
        if (endpoint.connectPublished) await unpublishMoloFlowSnapshot(enterpriseId, endpoint.slug);
        await Endpoint.updateOne({_id: eid, enterpriseId}, {
            $set: {
                connectPublished: false,
                connectUrl: '',
                connectPublishedAt: null,
                connectLastError: ''
            }
        });
        return {success: true, published: false};
    } catch (error) {
        throw toHttpError(error);
    }
});
