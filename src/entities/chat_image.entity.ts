import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class ChatImage {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 1000 })
  prompt: string

  @Column()
  name: string

  @Column({ type: 'bigint' })
  size: number

  @Column()
  url: string

  @Column({ name: 'create_time', precision: 3 })
  createTime: Date
}
