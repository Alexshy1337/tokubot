import { ParseModeFlavor, fmt, spoiler } from '@grammyjs/parse-mode'
import { autoQuote } from '@roziscoding/grammy-autoquote'
import debug from 'debug'
import { Composer, Context } from 'grammy'

const log = debug('app:unspoil')
export const unspoil = new Composer<ParseModeFlavor<Context>>().use(autoQuote)

unspoil.command('unspoil', async ctx => {
    const reply = ctx.msg.reply_to_message
    // Let's assume that if sender added spoiler to media they remember to add spoiler to text too. Or maybe we chould resend regardless of media spoiler on original message
    if (!reply || reply.has_media_spoiler) {
        await ctx.reply('Для того чтобы убрать спойлер ответьте на сообщение')
        return
    }

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
        const header = `${reply.from?.username ?? reply.from?.first_name ?? 'Анонимус'} пишет: `
        let text = reply.text
        if (text.length >= 2048 - header.length) {
            text = text.slice(0, 2048 - header.length - 4) + '...'
        }
        await ctx.replyFmt(
            fmt`${reply.from?.username ?? reply.from?.first_name ?? 'Анонимус'} пишет: ${spoiler(reply.text)}`
        )
    }
    try {
        await ctx.api.deleteMessage(reply.chat.id, reply.message_id)
    } catch (e) {
        log(e)
    }
})
