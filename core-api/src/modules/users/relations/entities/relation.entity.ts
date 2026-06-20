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
@Index(['request_side_id', 'relation_type', 'is_restricted'])
export class Relation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  request_side_id: string;

  @Index()
  @Column({ type: 'uuid' })
  accept_side_id: string;

  @ManyToOne(() => User, (user) => user.sent_relations)
  @JoinColumn({ name: 'request_side_id' })
  request_side: User;

  @ManyToOne(() => User, (user) => user.received_relations)
  @JoinColumn({ name: 'accept_side_id' })
  accept_side: User;

  @Column({ type: 'enum', enum: RelationType })
  relation_type: RelationType;

  @Column({ default: false })
  is_restricted: boolean;

  @Column({ default: false })
  is_mutual: boolean;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
