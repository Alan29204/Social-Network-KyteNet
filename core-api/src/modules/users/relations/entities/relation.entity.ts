import { RelationType } from 'src/common/enums/relation.enum';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['request_side_id', 'accept_side_id'], { unique: true })
export class Relation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  request_side_id: string;

  @Index()
  @Column()
  accept_side_id: string;

  @ManyToOne(() => User, (user) => user.sent_relations)
  @JoinColumn({ name: 'request_side_id' })
  request_side: User;

  @ManyToOne(() => User, (user) => user.received_relations)
  @JoinColumn({ name: 'accept_side_id' })
  accept_side: User;

  @Column({ type: 'enum', enum: RelationType })
  relation_type: RelationType;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
