import { Api, Composer } from 'grammy'
import * as cron from 'node-cron'
import { TOKU_CHAT } from './constants'
import { AllFictionModel } from './models/all-fiction'

export const allFiction = (api: Api) => {
    const allFiction = new Composer

    let lastMessageId = 0

    allFiction.filter(
        ctx => ctx.chat?.id == TOKU_CHAT,
        async (ctx, next) => {
            if (ctx.msg?.message_id && ctx.msg.message_id > lastMessageId) {
                lastMessageId = ctx.msg.message_id
                if(lastMessageId % 10_000 == 0) {
                    await ctx.reply(`Это было ${lastMessageId} сообщение`, {
                        reply_parameters: {
                            message_id: lastMessageId
                        }
                    })
                }
            }

            await next()
        }
    )

    cron.schedule('0 0 0 * * *', async () => {
        const doc = await findOrCreate()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayFormatted = [
            yesterday.getDate(),
            yesterday.getMonth() + 1,
            yesterday.getFullYear()
        ].map(n => n.toString().padStart(2, '0')).join('.')
        const estimatedDays = (1_000_000 - lastMessageId) * (doc.lastStats.length + 1) / doc.lastStats.concat(lastMessageId - doc.lastStartMessage).reduce((a, b) => a + b)
        let estimated = `Этого хватит приблизительно на ${estimatedDays.toFixed(0)} дней!`

        try {
            await api.sendMessage(TOKU_CHAT, `Последнее сообщение на ${yesterdayFormatted} было под номером ${lastMessageId}!\n\nЗа сегодня было написано ${lastMessageId - doc.lastStartMessage} сообщений!\n\nДо тепловой смерти чата осталось ${1_000_000 - lastMessageId} сообщений!\n\n${estimated}`)
        } catch(e) {
            // Nothing
        }

        doc.lastStats.push(lastMessageId - doc.lastStartMessage)
        doc.lastStats = doc.lastStats.slice(-6)
        doc.lastStartMessage = lastMessageId
        await doc.save()
    })

    async function findOrCreate() {
        const doc = await AllFictionModel.findOne()
        if (doc) {
            return doc
        }
        return new AllFictionModel()
    }

    return allFiction
}