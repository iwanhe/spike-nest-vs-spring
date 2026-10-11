-- V1: skema awal aplikasi uji "Pengajuan Pembelian"
CREATE TABLE pengajuan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor        text NOT NULL UNIQUE,
  pemohon      text NOT NULL,
  pemasok      text NOT NULL,
  status       text NOT NULL DEFAULT 'DRAF'
               CHECK (status IN ('DRAF','DIAJUKAN','DISETUJUI','DITOLAK','ESKALASI')),
  total        numeric(20,2) NOT NULL DEFAULT 0,
  dibuat_pada  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pengajuan_baris (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengajuan_id  uuid NOT NULL REFERENCES pengajuan(id),
  nama_barang   text NOT NULL,
  jumlah        numeric(12,3) NOT NULL CHECK (jumlah > 0),
  harga_satuan  numeric(20,2) NOT NULL CHECK (harga_satuan >= 0)
);
CREATE INDEX pengajuan_baris_pengajuan_idx ON pengajuan_baris (pengajuan_id);

CREATE TABLE persetujuan (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengajuan_id     uuid NOT NULL REFERENCES pengajuan(id),
  penyetuju        text NOT NULL,
  keputusan        text NOT NULL CHECK (keputusan IN ('SETUJU','TOLAK','ESKALASI')),
  catatan          text,
  diputuskan_pada  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entitas     text NOT NULL,
  entitas_id  uuid NOT NULL,
  aksi        text NOT NULL,
  pelaku      text NOT NULL,
  pada        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id   uuid NOT NULL REFERENCES pengajuan(id),
  payload        jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'MENUNGGU'
                 CHECK (status IN ('MENUNGGU','TERKIRIM','GAGAL')),
  percobaan      integer NOT NULL DEFAULT 0,
  kirim_setelah  timestamptz NOT NULL DEFAULT now(),
  dibuat_pada    timestamptz NOT NULL DEFAULT now(),
  terkirim_pada  timestamptz
);
CREATE INDEX outbox_menunggu_idx ON outbox (kirim_setelah) WHERE status = 'MENUNGGU';
