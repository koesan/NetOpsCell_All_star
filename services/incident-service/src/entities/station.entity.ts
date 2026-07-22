import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Baz istasyonu katalogu — operasyon haritasinin ve telemetri girisinin referans verisi.
 * Gercek istasyon entegrasyonu beklenmez (case 4.1); katalog, telemetri simulatorunun ve
 * musteri ariza bildiriminin uzerinde calistigi gercekci bir envanter saglar. */
@Entity("stations")
export class Station {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "varchar" })
  code: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar" })
  district: string;

  @Column({ type: "varchar" })
  region: string;

  @Column({ type: "float" })
  latitude: number;

  @Column({ type: "float" })
  longitude: number;

  @Column({ type: "varchar", default: "4G/5G" })
  technology: string;

  /** Istasyonun kapsadigi yaklasik abone sayisi — AI oncelik atamasindaki
   * "buyuk kapsama alani + yuksek olasilik -> KRITIK" kuralina gorsel baglam saglar. */
  @Column({ type: "int", default: 10000 })
  coverageUsers: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
