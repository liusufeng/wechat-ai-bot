import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { ChatContext } from './chat_context.entity'

@Entity()
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'contact_id' })
  contactId: string

  @Column({ name: 'contact_name' })
  contactName: string

  @Column({ name: 'room_id' })
  roomId: string

  @Column({ name: 'room_name' })
  roomName: string

  @Column({ name: 'start_time', precision: 3 })
  startTime: Date

  @Column({ name: 'end_time', precision: 3 })
  endTime: Date

  @OneToMany(() => ChatContext, (chatContext) => chatContext.session)
  contextList: ChatContext[]
}
