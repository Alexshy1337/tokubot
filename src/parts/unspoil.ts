import { FormattedString, ParseModeFlavor, fmt, spoiler } from '@grammyjs/parse-mode'
import { autoQuote } from '@roziscoding/grammy-autoquote'
import debug from 'debug'
import { Composer, Context } from 'grammy'
import { ADMINS } from '../constants'
import { MessageEntity } from 'grammy/types'

const log = debug('app:unspoil')
const ROT_TIME = 5 * 60
export const unspoil = new Composer<ParseModeFlavor<Context>>().use(autoQuote)

function spoilerEntities(text: string, entities: MessageEntity[], range?: { offset: number, length: number }): FormattedString {
    const { offset, length } = range ?? { offset: 0, length: text.length }
    let start = offset, end = offset + length

    const filteredEntities = entities.filter(entity => {
        // Telegram forcefully unspoils monotype
        if (entity.type == 'pre' || entity.type == 'code')
            return false

        if (entity.type != 'spoiler')
            return true

        const entityStart = entity.offset, entityEnd = entity.offset + entity.length

        // Start overlap; extending
        if (entityStart < start && entityEnd > entityStart) {
            start = entityStart
        }

        // End overlap; extending
        if (entityStart < end && entityEnd > end) {
            end = entityEnd
        }

        if (entityStart >= start && entityEnd <= end)
            return false

        return true
    })

    return new FormattedString(
        text,
        filteredEntities.concat([{
            type: 'spoiler',
            offset: start,
            length: end - start
        }])
    )
}

unspoil.command('unspoil', async ctx => {
    const reply = ctx.msg.reply_to_message
    // Let's assume that if sender added spoiler to media they remember to add spoiler to text too. Or maybe we chould resend regardless of media spoiler on original message
    if (!reply || reply.has_media_spoiler || reply.sticker || reply.story) {
        await ctx.reply('Для того чтобы убрать спойлер ответьте на сообщение')
        return
    }

    const isAdmin = ctx.from ? ADMINS.includes(ctx.from.id) : false

    if (Date.now() / 1000 - reply.date > ROT_TIME && !isAdmin) {
        await ctx.reply('Сообщение слишком старое')
        return
    }

    if (reply.from?.id == ctx.me.id && !isAdmin) {
        return
    }

    const sender = reply.from?.username ?? reply.from?.first_name ?? 'Анонимус'
    const reason = ctx.match.trim()

    if (reply.photo) {
        await ctx.replyWithPhoto(
            reply.photo.at(-1)!.file_id,
            {
                caption: reply.caption,
                caption_entities: reply.caption_entities,
                has_spoiler: true
            }
        )
    } else if (reply.animation) {
        await ctx.replyWithAnimation(
            reply.animation.file_id,
            {
                caption: reply.caption,
                caption_entities: reply.caption_entities,
                has_spoiler: true
            }
        )
    } else if (reply.video) {
        await ctx.replyWithVideo(
            reply.video.file_id,
            {
                caption: reply.caption,
                caption_entities: reply.caption_entities,
                has_spoiler: true
            }
        )
    } else if (reply.text) {
        const spoilerReason = reason.length > 0 ? ` спойлер к ${reason}` : ``
        const header = `${sender} пишет${spoilerReason}: `
        let text = reply.text
        if (text.length >= 2048 - header.length) {
            text = text.slice(0, 2048 - header.length - 4) + '...'
        }
        await ctx.replyFmt(
            fmt`${header}${spoilerEntities(reply.text, reply.entities ?? [])}`
        )
    } else {
        return
    }

    try {
        await ctx.api.deleteMessage(reply.chat.id, reply.message_id)
    } catch (e) {
        log(e)
    }
})
