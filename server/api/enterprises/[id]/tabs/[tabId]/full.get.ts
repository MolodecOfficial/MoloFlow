import { Tab } from '~~/server/models/tab.model'
import { Standard } from '~~/server/models/standard.model'
import { Entry } from '~~/server/models/entry.model'

export default defineEventHandler(async(event) => {
    const enterpriseId = getRouterParam(event,'id')
    const tabId = getRouterParam(event,'tabId')

    const [tab, standards, entries] = await Promise.all([
        Tab.findOne({
            _id: tabId,
            enterpriseId,
            isActive:true
        }).lean(),

        Standard.find({
            enterpriseId,
            tabId,
            isActive:true
        }).lean(),

        Entry.find({
            enterpriseId,
            tabId,
            isActive:true,
            isArchived:false
        }).lean()
    ])

    return {
        success:true,
        tab,
        standards,
        entries
    }
})