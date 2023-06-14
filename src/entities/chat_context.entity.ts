import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { ChatSession } from './chat_session.entity'

@Entity()
export class ChatContext {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'session_id', foreignKeyConstraintName: 'id' })
  sessionId: number

  @Column()
  role: 'system' | 'assistant' | 'user'

  @Column({ type: 'text' })
  content: string

  @Column()
  tokens: number

  @Column({ name: 'create_time', precision: 3 })
  createTime: Date

  @ManyToOne(() => ChatSession, (chatSession) => chatSession.contextList)
  @JoinColumn({ name: 'session_id', referencedColumnName: 'id' })
  session: ChatSession
}
