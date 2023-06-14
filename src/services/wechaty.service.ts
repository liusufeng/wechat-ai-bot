/**
 * Wechaty 微信机器人
 */
import { Injectable } from '@nestjs/common'
import {
  Contact,
  ContactSelf,
  Friendship,
  Message,
  Room,
  ScanStatus,
  Wechaty,
  WechatyBuilder
} from 'wechaty'
import * as qrcodeTerminal from 'qrcode-terminal'
import { concatMap, delay, from, range } from 'rxjs'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai'
import { encode } from 'gpt-3-encoder'
import { HttpService } from '@nestjs/axios'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { FileBox } from 'file-box'
import { ChatSession } from '../entities/chat_session.entity'
import { ChatContext } from '../entities/chat_context.entity'
import { ChatImage } from '../entities/chat_image.entity'
import configs from '../configs'

@Injectable()
export class WechatyService {
  private wechaty: Wechaty
  private openai: OpenAIApi

  private startDate: Date
  private FRIENDSHIP_KEYS: string[]
  private PREVENT_RECALL_NAMES: string[]
  private CHAT_COMMAND: {
    SYSTEM: string
    IMAGE: string
  }

  constructor(
    private httpService: HttpService,
    @InjectRepository(ChatSession)
    private readonly chatSession: Repository<ChatSession>,
    @InjectRepository(ChatContext)
    private readonly chatContext: Repository<ChatContext>,
    @InjectRepository(ChatImage)
    private readonly chatImage: Repository<ChatImage>
  ) {
    this.wechaty = WechatyBuilder.build({
      name: 'wechaty-ai-bot',
      puppet: 'wechaty-puppet-wechat',
      puppetOptions: {
        uos: true
      }
    })
    this.openai = new OpenAIApi(
      new Configuration({
        apiKey: configs.OPENAI_API_KEY,
        basePath: configs.OPENAI_PROXY_URL
      })
    )

    this.FRIENDSHIP_KEYS = configs.WECHAT_FRIENDSHIP_KEYS
    this.PREVENT_RECALL_NAMES = configs.WECHAT_PREVENT_RECALL_NAMES
    this.CHAT_COMMAND = configs.WECHAT_CHAT_COMMAND
  }

  // 启动微信机器人
  public start() {
    this.startDate = new Date()

    // 当机器人内部出错的时候会触发error 事件。
    this.wechaty.on('error', (error: Error) => this.onError(error))

    // 当机器人需要扫码登陆的时候会触发这个事件。
    this.wechaty.on('scan', (qrcode: string, status: ScanStatus) =>
      this.onScan(qrcode, status)
    )

    // 当机器人成功登录后，会触发login 事件，并会在事件中传递当前登陆机器人的信息。
    this.wechaty.on('login', (user: ContactSelf) => this.onLogin(user))

    // 当机器人检测到登出的时候，会触发logout 事件，并会在事件中传递机器人的信息。
    this.wechaty.on('logout', (user: ContactSelf) => this.onLogout(user))

    // 当有人给机器人发好友请求的时候会触发这个事件。
    this.wechaty.on('friendship', (friendship: Friendship) =>
      this.onFriendship(friendship)
    )

    // 当机器人收到消息的时候会触发这个事件。
    this.wechaty.on('message', (message: Message) => this.onMessage(message))

    return this.wechaty.start()
  }

  // 当机器人内部出错的时候会触发error 事件。
  private onError(error: Error) {
    console.error('error', error)
  }

  // 当机器人需要扫码登陆的时候会触发这个事件。
  private onScan(qrcode: string, status: ScanStatus) {
    if (status === ScanStatus.Waiting) {
      const qrcodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
        qrcode
      )}`
      console.log(`onScan：${ScanStatus[status]} ${qrcodeImageUrl}`)
      qrcodeTerminal.generate(qrcode, { small: true })
    } else {
      console.log(`onScan：${ScanStatus[status]}`)
    }
  }

  // 当机器人成功登录后，会触发login 事件，并会在事件中传递当前登陆机器人的信息。
  private onLogin(user: ContactSelf) {
    console.log(`用户【${user.name()}】登录成功！`)
  }

  // 当机器人检测到登出的时候，会触发logout 事件，并会在事件中传递机器人的信息。
  private onLogout(user: ContactSelf) {
    console.log(`用户【${user.name()}】退出登录！`)
  }

  // 当有人给机器人发好友请求的时候会触发这个事件。
  private async onFriendship(friendship: Friendship) {
    const FriendshipType = this.wechaty.Friendship.Type
    if (friendship.type() !== FriendshipType.Receive) return
    const contact = friendship.contact()
    const hello = friendship.hello()
    if (this.FRIENDSHIP_KEYS.length && !this.FRIENDSHIP_KEYS.includes(hello)) {
      console.log(
        `🤝🏻🤝🏻🤝🏻 / friendship 【${contact.name()}】发来好友申请, 未自动通过。验证消息是: ${hello}`
      )
      return
    }
    console.log(
      `👋👋👋 / friendship 【${contact.name()}】发来好友申请, 已自动通过。验证消息是: ${hello}`
    )
    await friendship.accept()
  }

  // 当机器人收到消息的时候会触发这个事件。
  private async onMessage(message: Message) {
    // 自己发送的消息不做处理
    if (message.self()) return
    // 避免重复处理
    if (message.date() < this.startDate) return
    // 消息类型列表
    const MessageType = this.wechaty.Message.Type
    // 消息类型
    const type = message.type()
    // 消息发送人
    const contact = message.talker()
    // 消息发送人id
    const contactId = contact.id
    // 消息发送人昵称
    const contactName = contact.name()
    // 群聊
    const room = message.room()
    // 群聊id
    const roomId = room ? room.id : ''
    // 群聊名称
    const roomName = room ? await room.topic() : ''

    // 群聊消息撤回
    if (type === MessageType.Recalled && room) {
      if (!this.PREVENT_RECALL_NAMES.includes(roomName)) return
      const recalledMessage = await message.toRecalled()
      console.log(message, recalledMessage)
      if (recalledMessage.type() !== MessageType.Text) return
      const replyText = `【${contactName}】撤回了一条消息：\n${recalledMessage.text()}`
      console.log(`👉👉👉 / recall ${replyText}`)
      await room.say(replyText)
      return
    }
    // 文本消息
    if (type === MessageType.Text) {
      // 朋友推荐消息
      if (!room && contact.id === 'fmessage') return
      // 消息时间
      const promptTime = new Date()
      // 是群聊 且 没有艾特机器人
      if (room && !(await message.mentionSelf())) return
      // 获取消息内容
      const content = room ? await message.mentionText() : message.text()
      // 无内容不处理
      if (!content) return
      // 不需要处理的消息
      if (
        !room &&
        [
          ...this.FRIENDSHIP_KEYS,
          `我是${contactName}`,
          '以上是打招呼的内容',
          `你已添加了${contactName}，现在可以开始聊天了。`,
          '收到红包，请在手机上查看',
          '[收到一条微信转账消息，请在手机上查看]',
          '[收到一条优惠券消息，请在手机上查看]',
          /^<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)$/.test(content)
        ].includes(content)
      )
        return
      // 处理特殊指令
      const command =
        Object.values(this.CHAT_COMMAND).find((command) =>
          content.startsWith(command)
        ) || ''
      const promptText = content.substring(command.length).trim()
      console.log(`🚀🚀🚀 / prompt ${roomName || contactName} ${promptText}`)
      // 生成图片
      if (command === this.CHAT_COMMAND.IMAGE) {
        await this.replyImage(promptText, contact, room)
        return
      }
      // 获取进行中的会话
      const { id: sessionId } = await this.getChatSession(
        contactId,
        contactName,
        roomId,
        roomName,
        promptTime,
        command
      )
      // 获取回复消息
      const replyText = await this.getReplyText(
        sessionId,
        promptText,
        promptTime,
        command
      )
      console.log(`🚀🚀🚀 / reply ${roomName || contactName} ${replyText}`)
      // 切片发送回复消息
      const prefixText = room
        ? `${promptText}\n- - - - - - - - - - - - - - -\n`
        : ''
      this.replyTextSlice(prefixText + replyText, contact, room)
      return
    }
  }

  // 获取聊天会话id
  private async getChatSession(
    contactId: string,
    contactName: string,
    roomId: string,
    roomName: string,
    promptTime: Date,
    command: string
  ) {
    // 不存在roomId，即为私聊，添加联系人id参数
    const findChatSessionWhere = { endTime: IsNull() }
    if (roomId) findChatSessionWhere['roomId'] = roomId
    else findChatSessionWhere['contactId'] = contactId
    // 获取正在进行的会话
    const chatSession = await this.chatSession.findOne({
      where: findChatSessionWhere,
      order: { startTime: 'DESC' }
    })
    // 存在进行中的会话
    if (chatSession) {
      // 不是新的系统指令，直接返回当前会话
      if (command !== this.CHAT_COMMAND.SYSTEM) return chatSession
      // 收到新的系统指令，停止当前会话
      await this.chatSession.update(chatSession.id, {
        endTime: promptTime
      })
    }
    // 创建新的会话并返回
    return await this.chatSession.save({
      contactId,
      contactName,
      roomId,
      roomName,
      startTime: promptTime
    })
  }

  // 获取回复消息
  private async getReplyText(
    sessionId: number,
    promptText: string,
    promptTime: Date,
    command: string
  ) {
    // 获取上下文消息
    const chatContexts = await this.chatContext.find({
      select: ['role', 'content', 'tokens'],
      where: { sessionId },
      order: { createTime: 'ASC' }
    })
    // 当超过4000token的时候，只保留3000token之后的对话
    const promptTokens = encode(promptText).length
    const messages = this.getContextMessages(chatContexts, promptTokens)
    // 调用 OpenAI 接口，获取上下文回复
    const response = await this.openai.createChatCompletion(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          ...messages,
          {
            role: command === this.CHAT_COMMAND.SYSTEM ? 'system' : 'user',
            content: promptText
          }
        ]
      },
      { timeout: 0 }
    )
    const replyText = response.data.choices[0].message.content
    const replyTime = new Date()
    const replyTokens = encode(replyText).length
    // 添加上下文消息
    this.chatContext
      .save([
        {
          sessionId,
          role: command === this.CHAT_COMMAND.SYSTEM ? 'system' : 'user',
          content: promptText,
          tokens: promptTokens,
          createTime: promptTime
        },
        {
          sessionId,
          role: 'assistant',
          content: replyText,
          tokens: replyTokens,
          createTime: replyTime
        }
      ])
      .then()
    return replyText
  }

  // 获取上下文消息，当超过4000token的时候，只保留3000token之后的对话
  private getContextMessages(
    messages: ChatContext[],
    promptTokens: number
  ): ChatCompletionRequestMessage[] {
    if (messages.length === 0) return []
    const tokens = messages.reduce(
      (total, item) => total + item.tokens,
      promptTokens
    )
    if (tokens > 4000) {
      if (messages[0].role === 'system') {
        return this.getContextMessages(
          [...messages.slice(0, 2), ...messages.slice(4)],
          promptTokens
        )
      }
      return this.getContextMessages(messages.slice(2), promptTokens)
    }
    return messages.map((item) => ({ role: item.role, content: item.content }))
  }

  // 切片回复消息
  private replyTextSlice(replyText: string, contact: Contact, room?: Room) {
    const maxLength = 2000
    const textNum = Math.ceil(replyText.length / maxLength)
    range(0, textNum)
      .pipe(
        concatMap((i) => {
          const text = replyText.substring(maxLength * i, maxLength * (i + 1))
          const sayReply = room ? room.say(text, contact) : contact.say(text)
          return from(sayReply).pipe(delay(300))
        })
      )
      .subscribe()
  }

  // 生成图片
  private async replyImage(promptText, contact: Contact, room?: Room) {
    const response = await this.openai.createImage(
      {
        prompt: promptText,
        n: 1,
        size: '1024x1024'
      },
      { timeout: 0 }
    )
    const url = response.data.data[0].url

    const fileInfo = await this.saveRemoteImage(url)

    const { fileName, filePath, fileSize, realPath } = fileInfo

    console.log(`🚀🚀🚀 / image ${realPath}`)

    await this.chatImage.save({
      prompt: promptText,
      name: fileName,
      size: fileSize,
      url: filePath,
      createTime: new Date()
    })
    const fileBox = FileBox.fromFile(realPath)
    await (room || contact).say(fileBox)
  }

  // 保存远程图片
  private async saveRemoteImage(
    url: string
  ): Promise<{ fileName; fileSize; filePath; realPath }> {
    const response = await this.httpService
      .get(url, { responseType: 'stream' })
      .toPromise()

    const imagePath = '/files/images/'
    const fileName = `${uuidv4()}.png`
    const targetFolder = path.join(process.cwd(), imagePath)
    const realPath = path.join(targetFolder, fileName)
    const filePath = imagePath + fileName

    // 创建目标文件夹
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(realPath)

      response.data.pipe(file)

      response.data.on('end', async () => {
        const stats = fs.statSync(realPath)
        const fileSize = stats.size

        resolve({ fileName, fileSize, filePath, realPath })
      })

      response.data.on('error', (error) => {
        reject(error)
      })
    })
  }
}
